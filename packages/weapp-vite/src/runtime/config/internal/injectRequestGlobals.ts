import type { PackageJson } from 'pkg-types'
import type {
  WeappAppPreludeConfig,
  WeappInjectRequestGlobalsConfig,
  WeappInjectRequestGlobalsTarget,
  WeappRequestRuntimeConfig,
} from '../../../types'
import {
  REQUEST_GLOBAL_ACTUALS_KEY,
  REQUEST_GLOBAL_EXPOSE_HELPER,
  REQUEST_GLOBAL_INSTALLER_HOST_REF,
  REQUEST_GLOBAL_LAZY_CONSTRUCTOR_HELPER,
  REQUEST_GLOBAL_LAZY_FUNCTION_HELPER,
  REQUEST_GLOBAL_MARK_PLACEHOLDER_HELPER,
  REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER,
  REQUEST_GLOBAL_PLACEHOLDER_KEY,
  REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER,
} from '@weapp-core/constants'
import { parse as parseSfc } from 'vue/compiler-sfc'
import { parseJsLike, traverse } from '../../../utils/babel'

export const FULL_REQUEST_GLOBAL_TARGETS: WeappInjectRequestGlobalsTarget[] = [
  'fetch',
  'Headers',
  'Request',
  'Response',
  'TextEncoder',
  'TextDecoder',
  'AbortController',
  'AbortSignal',
  'XMLHttpRequest',
  'WebSocket',
]

export const ABORT_REQUEST_GLOBAL_TARGETS: WeappInjectRequestGlobalsTarget[] = [
  'AbortController',
  'AbortSignal',
]

export const REQUEST_RUNTIME_REQUEST_TARGETS: WeappInjectRequestGlobalsTarget[] = [
  'fetch',
  'Headers',
  'Request',
  'Response',
  'TextEncoder',
  'TextDecoder',
  'AbortController',
  'AbortSignal',
  'XMLHttpRequest',
]

const REQUEST_RUNTIME_CORE_USAGE_TARGETS = new Set<WeappInjectRequestGlobalsTarget>([
  'fetch',
  'Headers',
  'Request',
  'Response',
  'XMLHttpRequest',
])

const DEFAULT_REQUEST_GLOBAL_DEPENDENCIES = ['axios', 'graphql-request', 'socket.io-client', 'engine.io-client']
const DEFAULT_ABORT_GLOBAL_DEPENDENCIES = ['@tanstack/query-core', '@tanstack/vue-query']
const WEBSOCKET_USAGE_HINT_RE = /\bwebsocket\b/iu
type WeappRequestGlobalFreeBindingTarget = WeappInjectRequestGlobalsTarget | 'URL' | 'URLSearchParams' | 'Blob' | 'FormData'

const REQUEST_GLOBAL_FREE_BINDING_TARGETS = new Set<WeappRequestGlobalFreeBindingTarget>([
  ...FULL_REQUEST_GLOBAL_TARGETS,
  'URL',
  'URLSearchParams',
  'Blob',
  'FormData',
])

export interface InjectRequestGlobalsAutoRule {
  dependencyPatterns: (string | RegExp)[]
  targets: WeappInjectRequestGlobalsTarget[]
}

export interface ResolvedInjectRequestGlobalsOptions {
  mode: 'auto' | 'explicit'
  targets: WeappInjectRequestGlobalsTarget[]
  dependencyPatterns?: (string | RegExp)[]
  prelude: boolean
}

export interface ResolveRequestRuntimeOptionsInput {
  appPrelude?: boolean | WeappAppPreludeConfig
  injectRequestGlobals?: boolean | WeappInjectRequestGlobalsConfig
}

const CODE_USAGE_AUTO_RULES: InjectRequestGlobalsAutoRule[] = [
  {
    dependencyPatterns: ['axios', 'graphql-request'],
    targets: [...REQUEST_RUNTIME_REQUEST_TARGETS],
  },
  {
    dependencyPatterns: ['socket.io-client', 'engine.io-client'],
    targets: [...FULL_REQUEST_GLOBAL_TARGETS],
  },
  {
    dependencyPatterns: [...DEFAULT_ABORT_GLOBAL_DEPENDENCIES],
    targets: [...ABORT_REQUEST_GLOBAL_TARGETS],
  },
]

function resolveAppPreludeRequestRuntimeConfig(
  appPrelude?: boolean | WeappAppPreludeConfig,
): boolean | WeappInjectRequestGlobalsConfig | undefined {
  if (!appPrelude || typeof appPrelude !== 'object' || !('requestRuntime' in appPrelude)) {
    return undefined
  }

  const requestRuntime = appPrelude.requestRuntime as boolean | WeappRequestRuntimeConfig | undefined
  if (requestRuntime === undefined) {
    return undefined
  }
  if (typeof requestRuntime === 'boolean') {
    return requestRuntime
      ? { enabled: true, prelude: true }
      : false
  }
  return {
    ...requestRuntime,
    prelude: true,
  }
}

function hasMatchedDependency(
  packageJson: PackageJson | undefined,
  patterns: readonly (string | RegExp)[],
) {
  const dependencyNames = new Set<string>([
    ...Object.keys(packageJson?.dependencies ?? {}),
    ...Object.keys(packageJson?.devDependencies ?? {}),
    ...Object.keys(packageJson?.peerDependencies ?? {}),
  ])

  return [...dependencyNames].some((dependency) => {
    return patterns.some((pattern) => {
      if (typeof pattern === 'string') {
        return pattern === dependency
      }
      pattern.lastIndex = 0
      return pattern.test(dependency)
    })
  })
}

function resolveTargets(config?: boolean | WeappInjectRequestGlobalsConfig): WeappInjectRequestGlobalsTarget[] {
  if (config && typeof config === 'object' && Array.isArray(config.targets) && config.targets.length > 0) {
    return [...new Set(config.targets)]
  }

  return [...FULL_REQUEST_GLOBAL_TARGETS]
}

function resolveDependencyPatterns(config?: boolean | WeappInjectRequestGlobalsConfig) {
  if (config && typeof config === 'object' && Array.isArray(config.dependencies) && config.dependencies.length > 0) {
    return config.dependencies
  }

  return DEFAULT_REQUEST_GLOBAL_DEPENDENCIES
}

function hasCustomAutoRuleConfig(config?: boolean | WeappInjectRequestGlobalsConfig) {
  if (!config || typeof config !== 'object') {
    return false
  }

  return Boolean(
    (Array.isArray(config.dependencies) && config.dependencies.length > 0)
    || (Array.isArray(config.targets) && config.targets.length > 0),
  )
}

function resolveAutoRules(config?: boolean | WeappInjectRequestGlobalsConfig): InjectRequestGlobalsAutoRule[] {
  if (hasCustomAutoRuleConfig(config)) {
    return [{
      dependencyPatterns: resolveDependencyPatterns(config),
      targets: resolveTargets(config),
    }]
  }

  return [
    {
      dependencyPatterns: DEFAULT_REQUEST_GLOBAL_DEPENDENCIES,
      targets: [...FULL_REQUEST_GLOBAL_TARGETS],
    },
    {
      dependencyPatterns: DEFAULT_ABORT_GLOBAL_DEPENDENCIES,
      targets: [...ABORT_REQUEST_GLOBAL_TARGETS],
    },
  ]
}

/**
 * @description 解析按需注入请求相关全局对象的最终配置。
 */
export function resolveInjectRequestGlobalsOptions(
  config: boolean | WeappInjectRequestGlobalsConfig | undefined,
  packageJson: PackageJson | undefined,
): ResolvedInjectRequestGlobalsOptions | null {
  if (config === false) {
    return null
  }

  if (config && typeof config === 'object' && config.enabled === false) {
    return null
  }

  const enabled = config && typeof config === 'object'
    ? config.enabled
    : config

  if (enabled === true) {
    return {
      mode: 'explicit',
      targets: resolveTargets(config),
      dependencyPatterns: resolveDependencyPatterns(config),
      prelude: config && typeof config === 'object' ? config.prelude === true : false,
    }
  }

  const autoRules = resolveAutoRules(config)
  const matchedTargets = new Set<WeappInjectRequestGlobalsTarget>()
  for (const rule of autoRules) {
    if (!hasMatchedDependency(packageJson, rule.dependencyPatterns)) {
      continue
    }
    for (const target of rule.targets) {
      matchedTargets.add(target)
    }
  }

  if (matchedTargets.size === 0) {
    return null
  }

  return {
    mode: 'auto',
    targets: [...matchedTargets],
    prelude: config && typeof config === 'object' ? config.prelude === true : false,
  }
}

export function resolveRequestRuntimeOptions(
  input: ResolveRequestRuntimeOptionsInput,
  packageJson: PackageJson | undefined,
  warn?: (message: string) => void,
): ResolvedInjectRequestGlobalsOptions | null {
  const nestedConfig = resolveAppPreludeRequestRuntimeConfig(input.appPrelude)
  const legacyConfig = input.injectRequestGlobals

  if (nestedConfig !== undefined) {
    if (legacyConfig !== undefined) {
      warn?.('`weapp.injectRequestGlobals` 已废弃，且当前会被 `weapp.appPrelude.requestRuntime` 覆盖。请迁移到 `weapp.appPrelude.requestRuntime`。')
    }
    return resolveInjectRequestGlobalsOptions(nestedConfig, packageJson)
  }

  if (legacyConfig !== undefined) {
    warn?.('`weapp.injectRequestGlobals` 已废弃，请迁移到 `weapp.appPrelude.requestRuntime`。')
  }

  return resolveInjectRequestGlobalsOptions(legacyConfig, packageJson)
}

function resolveRequestGlobalsRuntimeModuleId() {
  return 'weapp-vite/web-apis'
}

export function resolveRequestGlobalsBindingTargets(targets: WeappInjectRequestGlobalsTarget[]) {
  const bindingTargets: WeappRequestGlobalFreeBindingTarget[] = [...targets]
  const needsRequestRuntimeBinarySupport = targets.some(target => (
    target === 'fetch'
    || target === 'Request'
    || target === 'Response'
    || target === 'XMLHttpRequest'
    || target === 'WebSocket'
  ))

  if (needsRequestRuntimeBinarySupport) {
    bindingTargets.push('TextEncoder', 'TextDecoder')
    bindingTargets.push('URL', 'URLSearchParams', 'Blob', 'FormData')
  }

  return [...new Set(bindingTargets)].filter(target => REQUEST_GLOBAL_FREE_BINDING_TARGETS.has(target))
}

/**
 * @description 生成“被动局部绑定”代码。
 * @description 这层能力不能退化成只在 app.js 顶部安装全局对象。
 * @description 原因是 axios / graphql-request / socket.io-client 一类依赖经常会：
 * @description 1. 在模块初始化阶段直接读取自由变量；
 * @description 2. 在各自 chunk 作用域里执行 `typeof XMLHttpRequest` / `typeof fetch` / `new URL()`;
 * @description 3. 在全局对象完成安装前就完成环境探测并缓存结果。
 * @description 因此这里必须把 fetch / XMLHttpRequest / WebSocket / URL 等名字绑定到实际使用它们的产物作用域内。
 */
export function createRequestGlobalsPassiveBindingsCode(targets: WeappInjectRequestGlobalsTarget[]) {
  const bindingTargets = resolveRequestGlobalsBindingTargets(targets)
  if (bindingTargets.length === 0) {
    return ''
  }

  const helperCode = [
    `const ${REQUEST_GLOBAL_ACTUALS_KEY} = globalThis[${JSON.stringify(REQUEST_GLOBAL_ACTUALS_KEY)}] || (globalThis[${JSON.stringify(REQUEST_GLOBAL_ACTUALS_KEY)}] = Object.create(null))`,
    `function ${REQUEST_GLOBAL_MARK_PLACEHOLDER_HELPER}(value){try{Object.defineProperty(value,${JSON.stringify(REQUEST_GLOBAL_PLACEHOLDER_KEY)},{value:true,configurable:true})}catch{value[${JSON.stringify(REQUEST_GLOBAL_PLACEHOLDER_KEY)}]=true}return value}`,
    `function ${REQUEST_GLOBAL_LAZY_FUNCTION_HELPER}(name){const placeholder=function(...args){const actual=${REQUEST_GLOBAL_ACTUALS_KEY}[name];if(typeof actual!=="function"){throw new Error(name+" is not initialized")}return actual.apply(this,args)};return ${REQUEST_GLOBAL_MARK_PLACEHOLDER_HELPER}(placeholder)}`,
    `function ${REQUEST_GLOBAL_LAZY_CONSTRUCTOR_HELPER}(name){const placeholder=function(...args){const actual=${REQUEST_GLOBAL_ACTUALS_KEY}[name];if(typeof actual!=="function"){throw new Error(name+" is not initialized")}return Reflect.construct(actual,args)};return ${REQUEST_GLOBAL_MARK_PLACEHOLDER_HELPER}(placeholder)}`,
    `function ${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(value,args){if(typeof value!=="function"||value?.[${JSON.stringify(REQUEST_GLOBAL_PLACEHOLDER_KEY)}]===true){return false}try{return Reflect.construct(value,args),true}catch{return false}}`,
    `function ${REQUEST_GLOBAL_EXPOSE_HELPER}(name,value){if(value==null){return value}const current=globalThis[name];if(current===value){return value}if(typeof current!=="function"||current?.[${JSON.stringify(REQUEST_GLOBAL_PLACEHOLDER_KEY)}]===true){try{globalThis[name]=value}catch{}}return value}`,
  ].join(';')
  const bindingCode = bindingTargets.map((target) => {
    if (target === 'fetch') {
      return `var fetch = ${REQUEST_GLOBAL_EXPOSE_HELPER}("fetch",typeof ${REQUEST_GLOBAL_ACTUALS_KEY}["fetch"]==="function"&&${REQUEST_GLOBAL_ACTUALS_KEY}["fetch"]?.[${JSON.stringify(REQUEST_GLOBAL_PLACEHOLDER_KEY)}]!==true?${REQUEST_GLOBAL_ACTUALS_KEY}["fetch"]:typeof globalThis.fetch==="function"&&globalThis.fetch?.[${JSON.stringify(REQUEST_GLOBAL_PLACEHOLDER_KEY)}]!==true?globalThis.fetch:${REQUEST_GLOBAL_LAZY_FUNCTION_HELPER}("fetch"))`
    }

    const placeholderFactory = `${REQUEST_GLOBAL_LAZY_CONSTRUCTOR_HELPER}(${JSON.stringify(target)})`
    const actualRef = `${REQUEST_GLOBAL_ACTUALS_KEY}[${JSON.stringify(target)}]`
    if (target === 'URL') {
      return `var URL = ${REQUEST_GLOBAL_EXPOSE_HELPER}("URL",${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(${actualRef},["https://request-globals.invalid"])?${actualRef}:${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(globalThis.URL,["https://request-globals.invalid"])?globalThis.URL:${placeholderFactory})`
    }
    if (target === 'URLSearchParams') {
      return `var URLSearchParams = ${REQUEST_GLOBAL_EXPOSE_HELPER}("URLSearchParams",${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(${actualRef},["client=graphql-request"])?${actualRef}:${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(globalThis.URLSearchParams,["client=graphql-request"])?globalThis.URLSearchParams:${placeholderFactory})`
    }
    if (target === 'Blob') {
      return `var Blob = ${REQUEST_GLOBAL_EXPOSE_HELPER}("Blob",${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(${actualRef},[])?${actualRef}:${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(globalThis.Blob,[])?globalThis.Blob:${placeholderFactory})`
    }
    if (target === 'FormData') {
      return `var FormData = ${REQUEST_GLOBAL_EXPOSE_HELPER}("FormData",${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(${actualRef},[])?${actualRef}:${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(globalThis.FormData,[])?globalThis.FormData:${placeholderFactory})`
    }
    if (target === 'Headers') {
      return `var Headers = ${REQUEST_GLOBAL_EXPOSE_HELPER}("Headers",${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(${actualRef},[])?${actualRef}:${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(globalThis.Headers,[])?globalThis.Headers:${placeholderFactory})`
    }
    if (target === 'Request') {
      return `var Request = ${REQUEST_GLOBAL_EXPOSE_HELPER}("Request",${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(${actualRef},["https://request-globals.invalid"])?${actualRef}:${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(globalThis.Request,["https://request-globals.invalid"])?globalThis.Request:${placeholderFactory})`
    }
    if (target === 'Response') {
      return `var Response = ${REQUEST_GLOBAL_EXPOSE_HELPER}("Response",${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(${actualRef},[null])?${actualRef}:${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(globalThis.Response,[null])?globalThis.Response:${placeholderFactory})`
    }
    if (target === 'TextEncoder') {
      return `var TextEncoder = ${REQUEST_GLOBAL_EXPOSE_HELPER}("TextEncoder",${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(${actualRef},[])?${actualRef}:${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(globalThis.TextEncoder,[])?globalThis.TextEncoder:${placeholderFactory})`
    }
    if (target === 'TextDecoder') {
      return `var TextDecoder = ${REQUEST_GLOBAL_EXPOSE_HELPER}("TextDecoder",${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(${actualRef},[])?${actualRef}:${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(globalThis.TextDecoder,[])?globalThis.TextDecoder:${placeholderFactory})`
    }
    if (target === 'XMLHttpRequest') {
      return `var XMLHttpRequest = ${REQUEST_GLOBAL_EXPOSE_HELPER}("XMLHttpRequest",${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(${actualRef},[])?${actualRef}:${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(globalThis.XMLHttpRequest,[])?globalThis.XMLHttpRequest:${placeholderFactory})`
    }
    if (target === 'WebSocket') {
      return `var WebSocket = ${REQUEST_GLOBAL_EXPOSE_HELPER}("WebSocket",${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(${actualRef},["wss://request-globals.invalid"])?${actualRef}:${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(globalThis.WebSocket,["wss://request-globals.invalid"])?globalThis.WebSocket:${placeholderFactory})`
    }
    if (target === 'AbortController') {
      return `var AbortController = ${REQUEST_GLOBAL_EXPOSE_HELPER}("AbortController",${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(${actualRef},[])?${actualRef}:${REQUEST_GLOBAL_USABLE_CONSTRUCTOR_HELPER}(globalThis.AbortController,[])?globalThis.AbortController:${placeholderFactory})`
    }

    return `var ${target} = ${REQUEST_GLOBAL_EXPOSE_HELPER}(${JSON.stringify(target)},typeof ${actualRef}==="function"&&${actualRef}?.[${JSON.stringify(REQUEST_GLOBAL_PLACEHOLDER_KEY)}]!==true?${actualRef}:typeof globalThis.${target}==="function"&&globalThis.${target}?.[${JSON.stringify(REQUEST_GLOBAL_PLACEHOLDER_KEY)}]!==true?globalThis.${target}:${placeholderFactory})`
  }).join(';')

  return `${helperCode};${bindingCode};`
}

const MANUAL_REQUEST_GLOBALS_IMPORT_RE = /from\s*['"](?:@wevu\/web-apis|weapp-vite\/web-apis)['"]/
const MANUAL_INSTALL_REQUEST_GLOBALS_CALL_RE = /\binstallRequestGlobals\s*\(/
const MANUAL_INSTALL_ABORT_GLOBALS_CALL_RE = /\binstallAbortGlobals\s*\(/

function normalizeResolvedRequestGlobalTargets(
  targets: Iterable<WeappInjectRequestGlobalsTarget>,
  allowedTargets: readonly WeappInjectRequestGlobalsTarget[],
) {
  const resolvedSet = new Set(targets)
  return allowedTargets.filter(target => resolvedSet.has(target))
}

function extractRequestGlobalsUsageSource(code: string) {
  if (!code.includes('<script')) {
    return code
  }

  const { descriptor, errors } = parseSfc(code, {
    filename: 'request-globals-usage.vue',
    ignoreEmpty: false,
  })
  if (errors.length > 0) {
    return code
  }

  const blocks = [
    descriptor.script?.content,
    descriptor.scriptSetup?.content,
  ].filter((content): content is string => typeof content === 'string' && content.trim().length > 0)

  return blocks.join('\n')
}

function resolveReferencedRequestGlobalsTargets(
  code: string,
  allowedTargets: readonly WeappInjectRequestGlobalsTarget[],
) {
  if (allowedTargets.length === 0) {
    return []
  }

  const usageSource = extractRequestGlobalsUsageSource(code)
  if (!usageSource.trim()) {
    return []
  }

  const allowedTargetSet = new Set(allowedTargets)
  const fastPathMatched = allowedTargets.some(target => new RegExp(`\\b${target}\\b`, 'u').test(usageSource))
  if (!fastPathMatched) {
    return []
  }

  try {
    const ast = parseJsLike(usageSource)
    const resolvedTargets = new Set<WeappInjectRequestGlobalsTarget>()

    traverse(ast as any, {
      Identifier(path: any) {
        const identifierName = path.node?.name
        if (!identifierName || !allowedTargetSet.has(identifierName)) {
          return
        }
        if (typeof path.isReferencedIdentifier === 'function' && !path.isReferencedIdentifier()) {
          return
        }
        if (path.scope?.hasBinding?.(identifierName)) {
          return
        }
        resolvedTargets.add(identifierName)
      },
    })

    return [...resolvedTargets]
  }
  catch {
    return allowedTargets.filter(target => new RegExp(`\\b${target}\\b`, 'u').test(usageSource))
  }
}

export function hasReferencedRequestGlobalsUsage(
  code: string,
  allowedTargets: readonly WeappInjectRequestGlobalsTarget[],
) {
  return resolveReferencedRequestGlobalsTargets(code, allowedTargets).length > 0
}

function matchesRequestGlobalDependencyPattern(specifier: string, pattern: string | RegExp) {
  if (typeof pattern === 'string') {
    return specifier === pattern
  }
  pattern.lastIndex = 0
  return pattern.test(specifier)
}

function resolveImportedRequestGlobalsTargets(
  code: string,
  allowedTargets: readonly WeappInjectRequestGlobalsTarget[],
) {
  if (allowedTargets.length === 0) {
    return []
  }

  const matchedSpecifiers = new Set<string>()
  const knownDependencyLiterals = [
    'axios',
    'graphql-request',
    'socket.io-client',
    'engine.io-client',
    '@tanstack/query-core',
    '@tanstack/vue-query',
  ]
  if (!knownDependencyLiterals.some(specifier => code.includes(specifier))) {
    return []
  }

  const addSpecifier = (specifier: unknown) => {
    if (typeof specifier === 'string' && specifier.length > 0) {
      matchedSpecifiers.add(specifier)
    }
  }

  try {
    const ast = parseJsLike(extractRequestGlobalsUsageSource(code))

    traverse(ast as any, {
      ImportDeclaration(path: any) {
        addSpecifier(path.node?.source?.value)
      },
      ExportNamedDeclaration(path: any) {
        addSpecifier(path.node?.source?.value)
      },
      ExportAllDeclaration(path: any) {
        addSpecifier(path.node?.source?.value)
      },
      CallExpression(path: any) {
        if (path.node?.callee?.type === 'Import') {
          addSpecifier(path.node.arguments?.[0]?.value)
          return
        }
        if (
          path.node?.callee?.type === 'Identifier'
          && path.node.callee.name === 'require'
        ) {
          addSpecifier(path.node.arguments?.[0]?.value)
        }
      },
    })
  }
  catch {
    for (const specifier of knownDependencyLiterals) {
      if (code.includes(specifier)) {
        matchedSpecifiers.add(specifier)
      }
    }
  }

  if (matchedSpecifiers.size === 0) {
    return []
  }

  const resolvedTargets = new Set<WeappInjectRequestGlobalsTarget>()
  for (const specifier of matchedSpecifiers) {
    for (const rule of CODE_USAGE_AUTO_RULES) {
      if (!rule.dependencyPatterns.some(pattern => matchesRequestGlobalDependencyPattern(specifier, pattern))) {
        continue
      }
      for (const target of rule.targets) {
        if (allowedTargets.includes(target)) {
          resolvedTargets.add(target)
        }
      }
    }
  }

  return normalizeResolvedRequestGlobalTargets(resolvedTargets, allowedTargets)
}

export function resolveManualRequestGlobalsTargets(code: string): WeappInjectRequestGlobalsTarget[] {
  if (!MANUAL_REQUEST_GLOBALS_IMPORT_RE.test(code)) {
    return []
  }

  const targets = new Set<WeappInjectRequestGlobalsTarget>()
  if (MANUAL_INSTALL_REQUEST_GLOBALS_CALL_RE.test(code)) {
    for (const target of FULL_REQUEST_GLOBAL_TARGETS) {
      targets.add(target)
    }
  }
  if (MANUAL_INSTALL_ABORT_GLOBALS_CALL_RE.test(code)) {
    for (const target of ABORT_REQUEST_GLOBAL_TARGETS) {
      targets.add(target)
    }
  }

  return [...targets]
}

/**
 * @description 根据源码里的实际引用情况，推导 auto 模式需要安装的最小请求全局集合。
 */
export function resolveAutoRequestGlobalsTargets(
  code: string,
  allowedTargets: readonly WeappInjectRequestGlobalsTarget[],
): WeappInjectRequestGlobalsTarget[] {
  const importedTargets = resolveImportedRequestGlobalsTargets(code, allowedTargets)
  const referencedTargets = resolveReferencedRequestGlobalsTargets(code, allowedTargets)
  const hasWebSocketUsageHint = allowedTargets.includes('WebSocket') && WEBSOCKET_USAGE_HINT_RE.test(code)
  if (referencedTargets.length === 0 && importedTargets.length === 0 && !hasWebSocketUsageHint) {
    return []
  }

  const resolvedTargets = new Set<WeappInjectRequestGlobalsTarget>()
  for (const target of importedTargets) {
    resolvedTargets.add(target)
  }
  const referencedTargetSet = new Set(referencedTargets)
  for (const target of referencedTargets) {
    resolvedTargets.add(target)
  }

  if (referencedTargets.some(target => REQUEST_RUNTIME_CORE_USAGE_TARGETS.has(target))) {
    for (const target of REQUEST_RUNTIME_REQUEST_TARGETS) {
      if (allowedTargets.includes(target)) {
        resolvedTargets.add(target)
      }
    }
  }
  else if (referencedTargetSet.has('AbortController') || referencedTargetSet.has('AbortSignal')) {
    for (const target of ABORT_REQUEST_GLOBAL_TARGETS) {
      if (allowedTargets.includes(target)) {
        resolvedTargets.add(target)
      }
    }
  }

  if (
    allowedTargets.includes('WebSocket')
    && (
      referencedTargetSet.has('WebSocket')
      || importedTargets.includes('WebSocket')
      || hasWebSocketUsageHint
    )
  ) {
    resolvedTargets.add('WebSocket')
  }

  return normalizeResolvedRequestGlobalTargets(resolvedTargets, allowedTargets)
}

/**
 * @description 生成入口文件用的请求全局对象注入代码。
 */
export function createInjectRequestGlobalsCode(
  targets: WeappInjectRequestGlobalsTarget[],
  options?: {
    localBindings?: boolean
    passiveLocalBindings?: boolean
  },
) {
  if (options?.passiveLocalBindings) {
    const passiveBindingsCode = createRequestGlobalsPassiveBindingsCode(targets)
    return passiveBindingsCode
      ? `/* ${REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER} */ ${passiveBindingsCode}\n`
      : ''
  }

  const runtimeModuleId = resolveRequestGlobalsRuntimeModuleId()
  const lines = [
    `import { installRequestGlobals as __weappViteInstallRequestGlobals } from ${JSON.stringify(runtimeModuleId)}`,
  ]

  if (options?.localBindings) {
    const bindingTargets = resolveRequestGlobalsBindingTargets(targets)
    lines.push(
      `const ${REQUEST_GLOBAL_INSTALLER_HOST_REF} = __weappViteInstallRequestGlobals({ targets: ${JSON.stringify(targets)} }) || globalThis`,
      ...bindingTargets.map(target => `var ${target} = ${REQUEST_GLOBAL_INSTALLER_HOST_REF}.${target}`),
    )
  }
  else {
    lines.push(`__weappViteInstallRequestGlobals({ targets: ${JSON.stringify(targets)} })`)
  }

  lines.push('')
  return lines.join('\n')
}

/**
 * @description 为 Vue SFC 入口生成合法的请求全局注入脚本块。
 */
export function createInjectRequestGlobalsSfcCode(
  targets: WeappInjectRequestGlobalsTarget[],
  options?: {
    localBindings?: boolean
    passiveLocalBindings?: boolean
    setup?: boolean
  },
) {
  const scriptAttrs = options?.setup ? ' setup lang="ts"' : ' lang="ts"'
  return `<script${scriptAttrs}>\n${createInjectRequestGlobalsCode(targets, options)}</script>\n`
}

function injectCodeIntoSfcBlock(source: string, startOffset: number, injection: string) {
  return `${source.slice(0, startOffset)}${injection}${source.slice(startOffset)}`
}

/**
 * @description 将请求全局对象注入到现有 SFC 脚本块，避免生成额外的重复 `<script>`。
 */
export function injectRequestGlobalsIntoSfc(
  source: string,
  targets: WeappInjectRequestGlobalsTarget[],
  options?: {
    localBindings?: boolean
    passiveLocalBindings?: boolean
  },
) {
  if (targets.length === 0) {
    return source
  }

  const injection = createInjectRequestGlobalsCode(targets, options)
  const { descriptor, errors } = parseSfc(source, {
    filename: 'request-globals.vue',
    ignoreEmpty: false,
  })

  if (errors.length > 0) {
    return `${createInjectRequestGlobalsSfcCode(targets, options)}${source}`
  }

  const inlineScript = descriptor.script && !descriptor.script.src
    ? descriptor.script
    : undefined
  if (inlineScript) {
    return injectCodeIntoSfcBlock(source, inlineScript.loc.start.offset, injection)
  }

  const inlineScriptSetup = descriptor.scriptSetup && !descriptor.scriptSetup.src
    ? descriptor.scriptSetup
    : undefined
  if (inlineScriptSetup) {
    return `${createInjectRequestGlobalsSfcCode(targets, options)}${source}`
  }

  if (!descriptor.script) {
    return `${createInjectRequestGlobalsSfcCode(targets, options)}${source}`
  }

  if (!descriptor.scriptSetup) {
    return `${createInjectRequestGlobalsSfcCode(targets, {
      ...options,
      setup: true,
    })}${source}`
  }

  return source
}
