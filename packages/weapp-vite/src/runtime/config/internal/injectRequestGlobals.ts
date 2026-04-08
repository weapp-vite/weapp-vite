import type { PackageJson } from 'pkg-types'
import type { WeappInjectRequestGlobalsConfig, WeappInjectRequestGlobalsTarget } from '../../../types'
import { parse as parseSfc } from 'vue/compiler-sfc'

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
  }
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

export function createRequestGlobalsPassiveBindingsCode(targets: WeappInjectRequestGlobalsTarget[]) {
  const bindingTargets = resolveRequestGlobalsBindingTargets(targets)
  if (bindingTargets.length === 0) {
    return ''
  }

  const helperCode = [
    'const __weappViteRequestGlobalsActuals__ = globalThis.__weappViteRequestGlobalsActuals__ || (globalThis.__weappViteRequestGlobalsActuals__ = Object.create(null))',
    'function __weappViteMarkRequestGlobalsPlaceholder__(value){try{Object.defineProperty(value,"__weappViteRequestGlobalsPlaceholder__",{value:true,configurable:true})}catch{value.__weappViteRequestGlobalsPlaceholder__=true}return value}',
    'function __weappViteCreateLazyRequestGlobalsFunction__(name){const placeholder=function(...args){const actual=__weappViteRequestGlobalsActuals__[name];if(typeof actual!=="function"){throw new Error(name+" is not initialized")}return actual.apply(this,args)};return __weappViteMarkRequestGlobalsPlaceholder__(placeholder)}',
    'function __weappViteCreateLazyRequestGlobalsConstructor__(name){const placeholder=function(...args){const actual=__weappViteRequestGlobalsActuals__[name];if(typeof actual!=="function"){throw new Error(name+" is not initialized")}return Reflect.construct(actual,args)};return __weappViteMarkRequestGlobalsPlaceholder__(placeholder)}',
    'function __weappViteHasUsableRequestGlobalsConstructor__(value,args){if(typeof value!=="function"||value?.__weappViteRequestGlobalsPlaceholder__===true){return false}try{return Reflect.construct(value,args),true}catch{return false}}',
    'function __weappViteExposeRequestGlobal__(name,value){if(value==null){return value}const current=globalThis[name];if(current===value){return value}if(typeof current!=="function"||current?.__weappViteRequestGlobalsPlaceholder__===true){try{globalThis[name]=value}catch{}}return value}',
  ].join(';')
  const bindingCode = bindingTargets.map((target) => {
    if (target === 'fetch') {
      return 'var fetch = __weappViteExposeRequestGlobal__("fetch",typeof __weappViteRequestGlobalsActuals__["fetch"]==="function"&&__weappViteRequestGlobalsActuals__["fetch"]?.__weappViteRequestGlobalsPlaceholder__!==true?__weappViteRequestGlobalsActuals__["fetch"]:typeof globalThis.fetch==="function"&&globalThis.fetch?.__weappViteRequestGlobalsPlaceholder__!==true?globalThis.fetch:__weappViteCreateLazyRequestGlobalsFunction__("fetch"))'
    }

    const placeholderFactory = `__weappViteCreateLazyRequestGlobalsConstructor__(${JSON.stringify(target)})`
    const actualRef = `__weappViteRequestGlobalsActuals__[${JSON.stringify(target)}]`
    if (target === 'URL') {
      return `var URL = __weappViteExposeRequestGlobal__("URL",__weappViteHasUsableRequestGlobalsConstructor__(${actualRef},["https://request-globals.invalid"])?${actualRef}:__weappViteHasUsableRequestGlobalsConstructor__(globalThis.URL,["https://request-globals.invalid"])?globalThis.URL:${placeholderFactory})`
    }
    if (target === 'URLSearchParams') {
      return `var URLSearchParams = __weappViteExposeRequestGlobal__("URLSearchParams",__weappViteHasUsableRequestGlobalsConstructor__(${actualRef},["client=graphql-request"])?${actualRef}:__weappViteHasUsableRequestGlobalsConstructor__(globalThis.URLSearchParams,["client=graphql-request"])?globalThis.URLSearchParams:${placeholderFactory})`
    }
    if (target === 'Blob') {
      return `var Blob = __weappViteExposeRequestGlobal__("Blob",__weappViteHasUsableRequestGlobalsConstructor__(${actualRef},[])?${actualRef}:__weappViteHasUsableRequestGlobalsConstructor__(globalThis.Blob,[])?globalThis.Blob:${placeholderFactory})`
    }
    if (target === 'FormData') {
      return `var FormData = __weappViteExposeRequestGlobal__("FormData",__weappViteHasUsableRequestGlobalsConstructor__(${actualRef},[])?${actualRef}:__weappViteHasUsableRequestGlobalsConstructor__(globalThis.FormData,[])?globalThis.FormData:${placeholderFactory})`
    }
    if (target === 'Headers') {
      return `var Headers = __weappViteExposeRequestGlobal__("Headers",__weappViteHasUsableRequestGlobalsConstructor__(${actualRef},[])?${actualRef}:__weappViteHasUsableRequestGlobalsConstructor__(globalThis.Headers,[])?globalThis.Headers:${placeholderFactory})`
    }
    if (target === 'Request') {
      return `var Request = __weappViteExposeRequestGlobal__("Request",__weappViteHasUsableRequestGlobalsConstructor__(${actualRef},["https://request-globals.invalid"])?${actualRef}:__weappViteHasUsableRequestGlobalsConstructor__(globalThis.Request,["https://request-globals.invalid"])?globalThis.Request:${placeholderFactory})`
    }
    if (target === 'Response') {
      return `var Response = __weappViteExposeRequestGlobal__("Response",__weappViteHasUsableRequestGlobalsConstructor__(${actualRef},[null])?${actualRef}:__weappViteHasUsableRequestGlobalsConstructor__(globalThis.Response,[null])?globalThis.Response:${placeholderFactory})`
    }
    if (target === 'XMLHttpRequest') {
      return `var XMLHttpRequest = __weappViteExposeRequestGlobal__("XMLHttpRequest",__weappViteHasUsableRequestGlobalsConstructor__(${actualRef},[])?${actualRef}:__weappViteHasUsableRequestGlobalsConstructor__(globalThis.XMLHttpRequest,[])?globalThis.XMLHttpRequest:${placeholderFactory})`
    }
    if (target === 'WebSocket') {
      return `var WebSocket = __weappViteExposeRequestGlobal__("WebSocket",__weappViteHasUsableRequestGlobalsConstructor__(${actualRef},["wss://request-globals.invalid"])?${actualRef}:__weappViteHasUsableRequestGlobalsConstructor__(globalThis.WebSocket,["wss://request-globals.invalid"])?globalThis.WebSocket:${placeholderFactory})`
    }
    if (target === 'AbortController') {
      return `var AbortController = __weappViteExposeRequestGlobal__("AbortController",__weappViteHasUsableRequestGlobalsConstructor__(${actualRef},[])?${actualRef}:__weappViteHasUsableRequestGlobalsConstructor__(globalThis.AbortController,[])?globalThis.AbortController:${placeholderFactory})`
    }

    return `var ${target} = __weappViteExposeRequestGlobal__(${JSON.stringify(target)},typeof ${actualRef}==="function"&&${actualRef}?.__weappViteRequestGlobalsPlaceholder__!==true?${actualRef}:typeof globalThis.${target}==="function"&&globalThis.${target}?.__weappViteRequestGlobalsPlaceholder__!==true?globalThis.${target}:${placeholderFactory})`
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
      ? `/* __weappViteRequestGlobalsPassiveBindings__ */ ${passiveBindingsCode}\n`
      : ''
  }

  const runtimeModuleId = resolveRequestGlobalsRuntimeModuleId()
  const lines = [
    `import { installRequestGlobals as __weappViteInstallRequestGlobals } from ${JSON.stringify(runtimeModuleId)}`,
  ]

  if (options?.localBindings) {
    const bindingTargets = resolveRequestGlobalsBindingTargets(targets)
    lines.push(
      `const __weappViteRequestGlobalsHost__ = __weappViteInstallRequestGlobals({ targets: ${JSON.stringify(targets)} }) || globalThis`,
      ...bindingTargets.map(target => `var ${target} = __weappViteRequestGlobalsHost__.${target}`),
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
