import type { PackageJson } from 'pkg-types'
import type {
  WeappAppPreludeConfig,
  WeappInjectRequestGlobalsConfig,
  WeappInjectRequestGlobalsTarget,
  WeappRequestRuntimeConfig,
} from '../../../types'
import { parse as parseSfc } from 'vue/compiler-sfc'
import {
  REQUEST_GLOBAL_ACTUALS_KEY,
  REQUEST_GLOBAL_PASSIVE_BINDINGS_MARKER,
  REQUEST_GLOBAL_PLACEHOLDER_KEY,
} from '../../../plugins/core/lifecycle/emit/constants'

export const FULL_REQUEST_GLOBAL_TARGETS: WeappInjectRequestGlobalsTarget[] = [
  'fetch',
  'Headers',
  'Request',
  'Response',
  'AbortController',
  'AbortSignal',
  'XMLHttpRequest',
  'WebSocket',
]

export const ABORT_REQUEST_GLOBAL_TARGETS: WeappInjectRequestGlobalsTarget[] = [
  'AbortController',
  'AbortSignal',
]

const DEFAULT_REQUEST_GLOBAL_DEPENDENCIES = ['axios', 'graphql-request', 'socket.io-client', 'engine.io-client']
const DEFAULT_ABORT_GLOBAL_DEPENDENCIES = ['@tanstack/query-core', '@tanstack/vue-query']
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
  const needsUrlGlobals = targets.some(target => (
    target === 'fetch'
    || target === 'Request'
    || target === 'Response'
    || target === 'XMLHttpRequest'
  ))

  if (needsUrlGlobals) {
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
    `const __ra = globalThis[${JSON.stringify(REQUEST_GLOBAL_ACTUALS_KEY)}] || (globalThis[${JSON.stringify(REQUEST_GLOBAL_ACTUALS_KEY)}] = Object.create(null))`,
    `function __rM(value){try{Object.defineProperty(value,${JSON.stringify(REQUEST_GLOBAL_PLACEHOLDER_KEY)},{value:true,configurable:true})}catch{value[${JSON.stringify(REQUEST_GLOBAL_PLACEHOLDER_KEY)}]=true}return value}`,
    'function __rF(name){const placeholder=function(...args){const actual=__ra[name];if(typeof actual!=="function"){throw new Error(name+" is not initialized")}return actual.apply(this,args)};return __rM(placeholder)}',
    'function __rC(name){const placeholder=function(...args){const actual=__ra[name];if(typeof actual!=="function"){throw new Error(name+" is not initialized")}return Reflect.construct(actual,args)};return __rM(placeholder)}',
    `function __rU(value,args){if(typeof value!=="function"||value?.[${JSON.stringify(REQUEST_GLOBAL_PLACEHOLDER_KEY)}]===true){return false}try{return Reflect.construct(value,args),true}catch{return false}}`,
    `function __rE(name,value){if(value==null){return value}const current=globalThis[name];if(current===value){return value}if(typeof current!=="function"||current?.[${JSON.stringify(REQUEST_GLOBAL_PLACEHOLDER_KEY)}]===true){try{globalThis[name]=value}catch{}}return value}`,
  ].join(';')
  const bindingCode = bindingTargets.map((target) => {
    if (target === 'fetch') {
      return `var fetch = __rE("fetch",typeof __ra["fetch"]==="function"&&__ra["fetch"]?.[${JSON.stringify(REQUEST_GLOBAL_PLACEHOLDER_KEY)}]!==true?__ra["fetch"]:typeof globalThis.fetch==="function"&&globalThis.fetch?.[${JSON.stringify(REQUEST_GLOBAL_PLACEHOLDER_KEY)}]!==true?globalThis.fetch:__rF("fetch"))`
    }

    const placeholderFactory = `__rC(${JSON.stringify(target)})`
    const actualRef = `__ra[${JSON.stringify(target)}]`
    if (target === 'URL') {
      return `var URL = __rE("URL",__rU(${actualRef},["https://request-globals.invalid"])?${actualRef}:__rU(globalThis.URL,["https://request-globals.invalid"])?globalThis.URL:${placeholderFactory})`
    }
    if (target === 'URLSearchParams') {
      return `var URLSearchParams = __rE("URLSearchParams",__rU(${actualRef},["client=graphql-request"])?${actualRef}:__rU(globalThis.URLSearchParams,["client=graphql-request"])?globalThis.URLSearchParams:${placeholderFactory})`
    }
    if (target === 'Blob') {
      return `var Blob = __rE("Blob",__rU(${actualRef},[])?${actualRef}:__rU(globalThis.Blob,[])?globalThis.Blob:${placeholderFactory})`
    }
    if (target === 'FormData') {
      return `var FormData = __rE("FormData",__rU(${actualRef},[])?${actualRef}:__rU(globalThis.FormData,[])?globalThis.FormData:${placeholderFactory})`
    }
    if (target === 'Headers') {
      return `var Headers = __rE("Headers",__rU(${actualRef},[])?${actualRef}:__rU(globalThis.Headers,[])?globalThis.Headers:${placeholderFactory})`
    }
    if (target === 'Request') {
      return `var Request = __rE("Request",__rU(${actualRef},["https://request-globals.invalid"])?${actualRef}:__rU(globalThis.Request,["https://request-globals.invalid"])?globalThis.Request:${placeholderFactory})`
    }
    if (target === 'Response') {
      return `var Response = __rE("Response",__rU(${actualRef},[null])?${actualRef}:__rU(globalThis.Response,[null])?globalThis.Response:${placeholderFactory})`
    }
    if (target === 'XMLHttpRequest') {
      return `var XMLHttpRequest = __rE("XMLHttpRequest",__rU(${actualRef},[])?${actualRef}:__rU(globalThis.XMLHttpRequest,[])?globalThis.XMLHttpRequest:${placeholderFactory})`
    }
    if (target === 'WebSocket') {
      return `var WebSocket = __rE("WebSocket",__rU(${actualRef},["wss://request-globals.invalid"])?${actualRef}:__rU(globalThis.WebSocket,["wss://request-globals.invalid"])?globalThis.WebSocket:${placeholderFactory})`
    }
    if (target === 'AbortController') {
      return `var AbortController = __rE("AbortController",__rU(${actualRef},[])?${actualRef}:__rU(globalThis.AbortController,[])?globalThis.AbortController:${placeholderFactory})`
    }

    return `var ${target} = __rE(${JSON.stringify(target)},typeof ${actualRef}==="function"&&${actualRef}?.[${JSON.stringify(REQUEST_GLOBAL_PLACEHOLDER_KEY)}]!==true?${actualRef}:typeof globalThis.${target}==="function"&&globalThis.${target}?.[${JSON.stringify(REQUEST_GLOBAL_PLACEHOLDER_KEY)}]!==true?globalThis.${target}:${placeholderFactory})`
  }).join(';')

  return `${helperCode};${bindingCode};`
}

const MANUAL_REQUEST_GLOBALS_IMPORT_RE = /from\s*['"](?:@wevu\/web-apis|weapp-vite\/web-apis)['"]/
const MANUAL_INSTALL_REQUEST_GLOBALS_CALL_RE = /\binstallRequestGlobals\s*\(/
const MANUAL_INSTALL_ABORT_GLOBALS_CALL_RE = /\binstallAbortGlobals\s*\(/

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
      `const __rh = __weappViteInstallRequestGlobals({ targets: ${JSON.stringify(targets)} }) || globalThis`,
      ...bindingTargets.map(target => `var ${target} = __rh.${target}`),
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
    return injectCodeIntoSfcBlock(source, inlineScriptSetup.loc.start.offset, injection)
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
