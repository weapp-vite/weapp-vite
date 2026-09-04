import type { Linter, Rule } from 'eslint'

export type MiniProgramRuntimeApiDiagnostic = 'off' | 'warn' | 'error'
export type MiniProgramRuntimeApiKind = 'global' | 'static-method' | 'instance-method'
export type MiniProgramRuntimeApiSupport = 'baseline' | 'polyfill-required' | 'unsupported'

export interface MiniProgramRuntimeApiEntry {
  api: string
  kind: MiniProgramRuntimeApiKind
  support: MiniProgramRuntimeApiSupport
  diagnostic: MiniProgramRuntimeApiDiagnostic
  platform: 'wechat'
  replacement?: string
  summary: string
}

const entry = (value: MiniProgramRuntimeApiEntry) => value

/**
 * 微信小程序 AppService 运行时能力清单。
 *
 * baseline 表示兼容基线可直接使用；polyfill-required 表示必须显式启用或调用
 * weapp-vite 兼容层；unsupported 表示业务运行时代码不应依赖该能力。
 */
export const miniProgramRuntimeApiCatalog: readonly MiniProgramRuntimeApiEntry[] = [
  ...[
    'fetch',
    'Headers',
    'Request',
    'Response',
    'AbortController',
    'AbortSignal',
    'XMLHttpRequest',
    'WebSocket',
    'URL',
    'URLSearchParams',
    'Blob',
    'File',
    'FormData',
    'TextEncoder',
    'TextDecoder',
    'atob',
    'btoa',
    'performance',
    'crypto',
    'Event',
    'CustomEvent',
    'queueMicrotask',
  ].map(api => entry({
    api,
    kind: 'global',
    support: 'polyfill-required',
    diagnostic: 'warn',
    platform: 'wechat',
    replacement: '启用 weapp.appPrelude.webRuntime，或从 @wevu/web-apis 使用显式兼容实现',
    summary: '不同基础库、真机和 DevTools 版本的宿主能力不一致，不能依赖隐式全局。',
  })),
  ...[
    'window',
    'document',
    'navigator',
    'self',
    'global',
    'location',
    'process',
    'Buffer',
    'localStorage',
    'sessionStorage',
    'setImmediate',
    'structuredClone',
  ].map(api => entry({
    api,
    kind: 'global',
    support: 'unsupported',
    diagnostic: 'error',
    platform: 'wechat',
    summary: '微信小程序 AppService 不提供可移植的浏览器或 Node.js 全局能力。',
  })),
  ...[
    ['Object.fromEntries', '使用 for...of 构造对象'],
    ['Object.hasOwn', '使用 Object.prototype.hasOwnProperty.call(...)'],
    ['Promise.any', '使用兼容实现或调整并发策略'],
    ['Promise.allSettled', '使用 Promise.all 包装每个任务结果'],
  ].map(([api, replacement]) => entry({
    api,
    kind: 'static-method',
    support: 'unsupported',
    diagnostic: 'error',
    platform: 'wechat',
    replacement,
    summary: '该现代内建超出项目的小程序 ES2018 运行时兼容基线。',
  })),
  ...[
    ['Array.prototype.at', '使用下标访问'],
    ['String.prototype.at', '使用 charAt() 或下标访问'],
    ['Array.prototype.flat', '使用循环展开数组'],
    ['Array.prototype.flatMap', '使用循环或 reduce 展开数组'],
    ['String.prototype.replaceAll', '使用带全局标志的正则 replace()'],
  ].map(([api, replacement]) => entry({
    api,
    kind: 'instance-method',
    support: 'unsupported',
    diagnostic: 'error',
    platform: 'wechat',
    replacement,
    summary: '该现代内建超出项目的小程序 ES2018 运行时兼容基线。',
  })),
]

const unsupportedEntries = miniProgramRuntimeApiCatalog.filter(item => item.support === 'unsupported')
const polyfillEntries = miniProgramRuntimeApiCatalog.filter(item => item.support === 'polyfill-required')

function staticPropertyName(node: any): string | undefined {
  if (!node.computed && node.property?.type === 'Identifier') {
    return node.property.name
  }
  if (node.computed && node.property?.type === 'Literal' && typeof node.property.value === 'string') {
    return node.property.value
  }
}

function isTypePosition(node: any) {
  let current = node.parent
  while (current) {
    if (String(current.type).startsWith('TS')) {
      return true
    }
    if (/Expression$|Statement$|Declaration$/.test(current.type)) {
      return false
    }
    current = current.parent
  }
  return false
}

function isLocallyBound(context: Rule.RuleContext, node: any, name: string) {
  let scope: any = context.sourceCode.getScope(node)
  while (scope) {
    const variable = scope.set?.get(name)
    if (variable?.defs?.length) {
      return true
    }
    scope = scope.upper
  }
  return false
}

function isScopeReference(context: Rule.RuleContext, node: any) {
  let scope: any = context.sourceCode.getScope(node)
  while (scope) {
    if (
      scope.references?.some((reference: any) => reference.identifier === node)
      || scope.through?.some((reference: any) => reference.identifier === node)
    ) {
      return true
    }
    scope = scope.upper
  }
  return false
}

function isInspectionOnlyReference(node: any) {
  return isTypePosition(node)
    || (node.parent?.type === 'UnaryExpression' && node.parent.operator === 'typeof')
}

function isRuntimeReference(context: Rule.RuleContext, node: any) {
  if (isInspectionOnlyReference(node)) {
    return false
  }
  return isScopeReference(context, node) && !isLocallyBound(context, node, node.name)
}

function staticRuntimeObjectName(context: Rule.RuleContext, node: any): string | undefined {
  if (node?.type === 'Identifier' && !isLocallyBound(context, node, node.name)) {
    return node.name
  }
  if (
    node?.type === 'MemberExpression'
    && node.object?.type === 'Identifier'
    && node.object.name === 'globalThis'
    && !isLocallyBound(context, node.object, 'globalThis')
  ) {
    return staticPropertyName(node)
  }
}

function report(context: Rule.RuleContext, node: any, entry: MiniProgramRuntimeApiEntry) {
  context.report({
    node,
    message: entry.replacement
      ? `{{api}} 不能作为隐式小程序运行时能力使用；{{replacement}}。`
      : `{{api}} 不是受支持的小程序运行时能力。`,
    data: {
      api: entry.api,
      replacement: entry.replacement,
    },
  })
}

function createRuntimeApiRule(entries: readonly MiniProgramRuntimeApiEntry[]): Rule.RuleModule {
  const globals = new Map(entries.filter(item => item.kind === 'global').map(item => [item.api, item]))
  const staticMethods = new Map(entries.filter(item => item.kind === 'static-method').map(item => [item.api, item]))
  const instanceMethods = new Map<string, MiniProgramRuntimeApiEntry>()
  for (const item of entries.filter(item => item.kind === 'instance-method')) {
    instanceMethods.set(item.api.slice(item.api.lastIndexOf('.') + 1), item)
  }

  return {
    meta: {
      type: 'problem',
      docs: { description: '限制小程序 AppService 不可移植的运行时 API' },
      schema: [],
      messages: {},
    },
    create(context) {
      return {
        Identifier(node: any) {
          const entry = globals.get(node.name)
          if (!entry || !isRuntimeReference(context, node)) {
            return
          }
          if (
            node.parent?.type === 'MemberExpression'
            && node.parent.property === node
            && !node.parent.computed
          ) {
            return
          }
          report(context, node, entry)
        },
        MemberExpression(node: any) {
          if (isInspectionOnlyReference(node)) {
            return
          }
          const property = staticPropertyName(node)
          if (!property) {
            return
          }
          if (
            node.object?.type === 'Identifier'
            && node.object.name === 'globalThis'
            && !isLocallyBound(context, node.object, 'globalThis')
          ) {
            const globalEntry = globals.get(property)
            if (globalEntry) {
              report(context, node, globalEntry)
            }
            return
          }
          const runtimeObjectName = staticRuntimeObjectName(context, node.object)
          if (runtimeObjectName) {
            const staticEntry = staticMethods.get(`${runtimeObjectName}.${property}`)
            if (staticEntry) {
              report(context, node, staticEntry)
              return
            }
          }
          const instanceEntry = instanceMethods.get(property)
          if (instanceEntry && node.parent?.type === 'CallExpression' && node.parent.callee === node) {
            report(context, node, instanceEntry)
          }
        },
      }
    },
  }
}

export const miniProgramRuntimePlugin = {
  meta: {
    name: 'weapp-vite-mini-program-runtime',
    version: '1.0.0',
  },
  rules: {
    'no-unsupported-runtime-api': createRuntimeApiRule(unsupportedEntries),
    'no-implicit-runtime-polyfill': createRuntimeApiRule(polyfillEntries),
  },
}

export interface MiniProgramRuntimeConfigOptions {
  files?: string[]
  ignores?: string[]
}

export const MINI_PROGRAM_RUNTIME_DEFAULT_FILES = ['src/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue}']
export const MINI_PROGRAM_RUNTIME_DEFAULT_IGNORES = [
  '**/node_modules/**',
  '**/dist/**',
  '**/dist-*/**',
  '**/.weapp-vite/**',
  '**/generated/**',
  '**/scripts/**',
  '**/src/**/node.{js,mjs,cjs,jsx,ts,mts,cts,tsx}',
  '**/src/**/*.web.*',
  '**/*.{test,spec}.{js,mjs,cjs,jsx,ts,mts,cts,tsx}',
]

export function createMiniProgramRuntimeConfig(options: MiniProgramRuntimeConfigOptions = {}): Linter.Config {
  return {
    files: options.files ?? MINI_PROGRAM_RUNTIME_DEFAULT_FILES,
    ignores: options.ignores ?? MINI_PROGRAM_RUNTIME_DEFAULT_IGNORES,
    plugins: {
      'mini-program': miniProgramRuntimePlugin,
    },
    rules: {
      'mini-program/no-unsupported-runtime-api': 'error',
      'mini-program/no-implicit-runtime-polyfill': 'warn',
    },
  }
}

export const miniProgramRuntimeRecommended: Linter.Config = createMiniProgramRuntimeConfig()
