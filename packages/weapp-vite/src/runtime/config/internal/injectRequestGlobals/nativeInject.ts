import type { MiniProgramNetworkDefaults } from '@wevu/web-apis'
import type { WeappInjectWebRuntimeDeclaredGlobalTarget, WeappInjectWebRuntimeDerivedGlobalTarget, WeappInjectWebRuntimeGlobalsTarget } from '../../../../types'
import type { RequestGlobalFreeBindingTarget } from './runtime'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  resolveNativeRequestGlobalsRuntimeEnsureModuleId,
  resolveNativeRequestGlobalsRuntimeGlobalModuleId,
  resolveNativeRequestGlobalsRuntimeModuleId,
  resolveRequestGlobalsBindingTargets,
  WEB_RUNTIME_DERIVED_BINDING_TARGETS,
  WEB_RUNTIME_GLOBAL_OBJECT_NAMES,
} from './runtime'

export const WEB_RUNTIME_INJECT_VIRTUAL_ID = 'virtual:weapp-vite-web-runtime:bindings'
export const WEB_RUNTIME_INJECT_RESOLVED_ID = 'weapp-vite:web-runtime:bindings'
export const WEB_RUNTIME_GLOBAL_VIRTUAL_PREFIX = 'virtual:weapp-vite-web-runtime:global:'
export const WEB_RUNTIME_GLOBAL_RESOLVED_PREFIX = 'weapp-vite:web-runtime:global:'
export const WEB_RUNTIME_APP_PRELUDE_VIRTUAL_ID = 'virtual:weapp-vite-web-runtime:app-prelude'
export const WEB_RUNTIME_APP_PRELUDE_RESOLVED_ID = 'weapp-vite:web-runtime:app-prelude.js'
export const WEB_RUNTIME_APP_PRELUDE_STARTUP_VIRTUAL_ID = 'virtual:weapp-vite-web-runtime:app-prelude-startup'
export const WEB_RUNTIME_APP_PRELUDE_STARTUP_RESOLVED_ID = 'weapp-vite:web-runtime:app-prelude-startup'
export const WEB_RUNTIME_APP_PRELUDE_CHUNK_FILE_BASENAME = 'weapp-vendors/web-runtime-app-prelude.js'

/**
 * native 自定义 App Prelude 分组规则的优先级。
 * 不变量：大于 0（默认分组不显式设优先级），保证自定义前置脚本先于默认 advanced-chunk 分组独立成块。
 * 精确绑定与桥接的分包交给打包器自然分组，不强制额外 vendor。
 * 升级 Rolldown 的 codeSplitting 语义时必须复验该不变量。
 */
export const NATIVE_APP_PRELUDE_CHUNK_PRIORITY = 91

export interface WebRuntimeNativeInject {
  inject: Record<string, string | [string, string]>
  code: string
  bindingTargets: RequestGlobalFreeBindingTarget[]
  globalTargets: RequestGlobalFreeBindingTarget[]
  userInject?: Record<string, string | [string, string]>
}

const NATIVE_TARGET_EXPORTS = {
  fetch: 'fetch',
  Headers: 'HeadersPolyfill',
  Request: 'RequestPolyfill',
  Response: 'ResponsePolyfill',
  TextEncoder: 'TextEncoderPolyfill',
  TextDecoder: 'TextDecoderPolyfill',
  AbortController: 'AbortControllerPolyfill',
  AbortSignal: 'AbortSignalPolyfill',
  XMLHttpRequest: 'XMLHttpRequestPolyfill',
  WebSocket: 'WebSocketPolyfill',
  atob: 'atobPolyfill',
  btoa: 'btoaPolyfill',
  queueMicrotask: 'queueMicrotaskPolyfill',
  performance: 'performancePolyfill',
  crypto: 'cryptoPolyfill',
  Event: 'EventPolyfill',
  CustomEvent: 'CustomEventPolyfill',
  ReadableStream: 'ReadableStream',
  WritableStream: 'WritableStream',
  TransformStream: 'TransformStream',
  TextDecoderStream: 'TextDecoderStreamPolyfill',
  EventSource: 'EventSourcePolyfill',
  URL: 'URLPolyfill',
  URLSearchParams: 'URLSearchParamsPolyfill',
  Blob: 'BlobPolyfill',
  File: 'FilePolyfill',
  FormData: 'FormDataPolyfill',
} satisfies Record<RequestGlobalFreeBindingTarget, string>

const NATIVE_GLOBAL_ENSURE_EXPORTS: Partial<Record<RequestGlobalFreeBindingTarget, string>> = {
  Headers: 'ensureWebRuntimeHeaders',
  Response: 'ensureWebRuntimeResponse',
  TextDecoder: 'ensureWebRuntimeTextDecoder',
  performance: 'ensureWebRuntimePerformance',
  crypto: 'ensureWebRuntimeCrypto',
  URL: 'ensureWebRuntimeURL',
  URLSearchParams: 'ensureWebRuntimeURLSearchParams',
  Blob: 'ensureWebRuntimeBlob',
  File: 'ensureWebRuntimeFile',
  FormData: 'ensureWebRuntimeFormData',
  TextDecoderStream: 'ensureWebRuntimeTextDecoderStream',
}

export function mergeWebRuntimeNativeInject(
  nativeInject: Record<string, string | [string, string]>,
  userInject: Record<string, string | [string, string]> | undefined,
) {
  const merged = {
    ...nativeInject,
    ...(userInject ?? {}),
  }
  for (const target of Object.keys(nativeInject)) {
    const override = userInject?.[target]
    if (override === undefined) {
      continue
    }
    for (const objectName of WEB_RUNTIME_GLOBAL_OBJECT_NAMES) {
      const dottedKey = `${objectName}.${target}`
      if (Object.hasOwn(nativeInject, dottedKey) && !Object.hasOwn(userInject ?? {}, dottedKey)) {
        merged[dottedKey] = override
      }
    }
  }
  return merged
}

function createNativeInjectOverrideImport(mapping: string | [string, string], localName: string) {
  if (typeof mapping === 'string') {
    return `import ${localName} from ${JSON.stringify(mapping)}`
  }
  const [moduleId, importedName] = mapping
  const importedSpecifier = /^[A-Za-z_$][\w$]*$/u.test(importedName)
    ? importedName
    : JSON.stringify(importedName)
  return `import { ${importedSpecifier} as ${localName} } from ${JSON.stringify(moduleId)}`
}

function isNativeBindingModuleId(moduleId: string) {
  return moduleId === WEB_RUNTIME_INJECT_VIRTUAL_ID || moduleId === WEB_RUNTIME_INJECT_RESOLVED_ID
}

export function getWebRuntimeGlobalVirtualId(target: string) {
  return `${WEB_RUNTIME_GLOBAL_VIRTUAL_PREFIX}${target}`
}

export function getWebRuntimeGlobalResolvedId(target: string) {
  return `${WEB_RUNTIME_GLOBAL_RESOLVED_PREFIX}${target}`
}

/**
 * 把已解析的目标桥接模块 id 还原成 Web Runtime 目标名。
 *
 * 桥接 id 只由 `getWebRuntimeGlobalResolvedId` 用公开目标名生成，因此这里把前缀后的片段收窄回目标联合类型，
 * 让调用方可以直接与 `bindingTargets` 做精确比较，而不必退化成宽泛的 `string`。
 * @param id - 待解析的模块 id。
 * @returns 命中桥接前缀时返回对应目标名，否则返回 `undefined`。
 */
export function resolveWebRuntimeGlobalTarget(id: string): RequestGlobalFreeBindingTarget | undefined {
  return id.startsWith(WEB_RUNTIME_GLOBAL_RESOLVED_PREFIX)
    ? id.slice(WEB_RUNTIME_GLOBAL_RESOLVED_PREFIX.length) as RequestGlobalFreeBindingTarget
    : undefined
}

/** 只判断 native Web Runtime 自身的虚拟模块 id，不含实现包模块。 */
export function isNativeWebRuntimeVirtualModuleId(id: string) {
  return isNativeBindingModuleId(id)
    || id.startsWith(WEB_RUNTIME_GLOBAL_VIRTUAL_PREFIX)
    || id.startsWith(WEB_RUNTIME_GLOBAL_RESOLVED_PREFIX)
}

export function createWebRuntimeNativeGlobalImports(targets: readonly string[]) {
  return [...new Set(targets)].map(target => `import ${JSON.stringify(getWebRuntimeGlobalVirtualId(target))};`).join('\n')
}

/**
 * 解析桥接使用的显式覆盖。
 *
 * 四类全局对象在宿主语义上互为别名，桥接统一安装到 `globalThis`；覆盖键则按
 * `globalThis` → `global` → `self` → `window` → 裸标识符的顺序取第一个显式项，
 * 避免某个对象别名上的配置被其他访问路径绕过。
 */
function resolveNativeGlobalBridgeOverride(
  userInject: Record<string, string | [string, string]> | undefined,
  target: string,
) {
  if (!userInject) {
    return undefined
  }
  for (const objectName of WEB_RUNTIME_GLOBAL_OBJECT_NAMES) {
    const dottedKey = `${objectName}.${target}`
    if (Object.hasOwn(userInject, dottedKey) && userInject[dottedKey] !== undefined) {
      return userInject[dottedKey]
    }
  }
  return Object.hasOwn(userInject, target) ? userInject[target] : undefined
}

export function createWebRuntimeGlobalBridgeCode(plan: WebRuntimeNativeInject, target: string) {
  const mapping = resolveNativeGlobalBridgeOverride(plan.userInject, target)
  const localName = '__weappViteGlobalBinding'
  const key = JSON.stringify(target)
  const ensureExport = NATIVE_GLOBAL_ENSURE_EXPORTS[target as RequestGlobalFreeBindingTarget]
  const runtimeModuleId = resolveNativeRequestGlobalsRuntimeModuleId()
  const usesLightweightEnsure = !ensureExport || target === 'performance' || target === 'crypto'
  const runtimeEnsureModuleId = usesLightweightEnsure
    ? resolveNativeRequestGlobalsRuntimeGlobalModuleId()
    : resolveNativeRequestGlobalsRuntimeEnsureModuleId()
  const runtimeImport = ensureExport
    ? `import { ${ensureExport} as __weappViteEnsureGlobal, markWebRuntimeGlobalInstalled as __weappViteMarkNativeGlobal } from ${JSON.stringify(runtimeEnsureModuleId)}`
    : `import { markWebRuntimeGlobalInstalled as __weappViteMarkNativeGlobal, shouldInstallWebRuntimeGlobal as __weappViteShouldInstallGlobal } from ${JSON.stringify(runtimeEnsureModuleId)}`
  const ensureArgs = target === 'Response'
    ? `, ${localName}`
    : target === 'TextDecoderStream'
      ? ', __weappViteUsesNativeStreams'
      : ''
  const resolveValue = ensureExport
    ? `__weappViteEnsureGlobal(__weappViteGlobalCurrent, ${localName}${ensureArgs})`
    : `__weappViteShouldInstallGlobal(__weappViteGlobalCurrent) ? ${localName} : __weappViteGlobalCurrent`
  return [
    runtimeImport,
    ...(target === 'TextDecoderStream'
      ? [`import { usesNativeStreams as __weappViteUsesNativeStreams } from ${JSON.stringify(runtimeModuleId)}`]
      : []),
    mapping
      ? createNativeInjectOverrideImport(mapping, localName)
      : `import { ${target} as ${localName} } from ${JSON.stringify(WEB_RUNTIME_INJECT_VIRTUAL_ID)}`,
    `let __weappViteGlobalCurrent`,
    `try { __weappViteGlobalCurrent = globalThis[${key}] } catch {}`,
    `const __weappViteGlobalValue = ${resolveValue}`,
    `if (__weappViteGlobalValue !== __weappViteGlobalCurrent) {`,
    `  try {`,
    `    globalThis[${key}] = __weappViteGlobalValue`,
    `    if (globalThis[${key}] === __weappViteGlobalValue) { __weappViteMarkNativeGlobal(__weappViteGlobalValue) }`,
    `  } catch {}`,
    `}`,
    '',
  ].join('\n')
}

export interface NativeWebRuntimeModuleMatcherOptions {
  /** 实现包根目录；默认从真实解析结果推导，不接受按路径子串猜测。 */
  resolveImplementationRoot?: () => string | undefined
  platform?: NodeJS.Platform
}

/** 从已解析入口路径向上定位指定包名的包根目录。 */
function findPackageRoot(entryPath: string, packageName: string) {
  let directory = path.dirname(entryPath)
  while (true) {
    const manifest = path.join(directory, 'package.json')
    if (existsSync(manifest)) {
      const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string }
      if (parsed.name === packageName) {
        return directory
      }
      break
    }
    const parent = path.dirname(directory)
    if (parent === directory) {
      break
    }
    directory = parent
  }
  throw new Error(`无法从解析结果定位 ${packageName} 实现根目录；native 全局桥接分组需要该依赖。`)
}

/** Node 解析 fallback：仅在拿不到打包器解析结果时使用。 */
function resolveWebApisImplementationRoot() {
  const entry = (import.meta as { resolve: (specifier: string) => string }).resolve('@wevu/web-apis/runtime')
  return findPackageRoot(fileURLToPath(entry), '@wevu/web-apis')
}

/** 由打包器解析出的入口路径推导实现包根，供 plugin 捕获时调用。 */
export function nativeWebApisImplementationRootFromEntry(entryPath: string) {
  return findPackageRoot(entryPath, '@wevu/web-apis')
}

/**
 * 识别 native Web Runtime 自身的虚拟模块与实现模块。
 * 实现模块按解析出的包根目录匹配，虚拟模块按固定 id 前缀匹配；两种情况都不依赖目录名猜测。
 */
export function createNativeWebRuntimeModuleMatcher(options: NativeWebRuntimeModuleMatcherOptions = {}) {
  const platform = options.platform ?? process.platform
  const normalize = (value: string) => value.replace(/\\/gu, '/').replace(/\/+$/u, '')
  const fold = (value: string) => platform === 'win32' ? value.toLowerCase() : value
  let nodeRoot: string | undefined
  const resolveRoot = () => {
    const resolvedRoot = options.resolveImplementationRoot?.()
    if (resolvedRoot) {
      return resolvedRoot
    }
    // Node 解析仅作 fallback 且 memoize。
    nodeRoot ??= resolveWebApisImplementationRoot()
    return nodeRoot
  }
  return (id: string) => {
    if (isNativeWebRuntimeVirtualModuleId(id)) {
      return true
    }
    const implementationRoot = fold(normalize(resolveRoot()))
    const normalizedId = fold(normalize(id))
    return normalizedId === implementationRoot || normalizedId.startsWith(`${implementationRoot}/`)
  }
}

export function createWebRuntimeNativeInject(
  targets: WeappInjectWebRuntimeGlobalsTarget[],
  networkDefaults?: MiniProgramNetworkDefaults,
  userInject?: Record<string, string | [string, string]>,
  globalTargets: WeappInjectWebRuntimeDeclaredGlobalTarget[] = [],
): WebRuntimeNativeInject | null {
  if (targets.length === 0) {
    return null
  }

  const bindingTargets = resolveRequestGlobalsBindingTargets(targets)
  const declaredBaseTargets = globalTargets.filter((target): target is WeappInjectWebRuntimeGlobalsTarget =>
    !WEB_RUNTIME_DERIVED_BINDING_TARGETS.includes(target as WeappInjectWebRuntimeDerivedGlobalTarget))
  // globalTargets 独立于 targets 绑定资格：按声明目标 + 自身必要依赖闭包生成桥接，不被 targets 裁剪，
  // 否则收窄 targets 时声明的隐藏全局访问会静默失效。
  const resolvedGlobalTargets = [...new Set([
    ...resolveRequestGlobalsBindingTargets(declaredBaseTargets),
    ...globalTargets,
  ])]
  // bindings 模块导出 targets 闭包与 globalTargets 闭包的并集，保证任意桥接都能导入实现；
  // 自由标识符 inject 仍只绑定 targets 闭包，两个关注点正交。
  const moduleBindingTargets = [...new Set([...bindingTargets, ...resolvedGlobalTargets])]
  const defaultInject: Record<string, [string, string]> = {}
  for (const target of bindingTargets) {
    const mapping: [string, string] = [WEB_RUNTIME_INJECT_VIRTUAL_ID, target]
    defaultInject[target] = mapping
    // 点号全局访问与自由标识符共享同一精确绑定；Rolldown 会尊重局部同名遮蔽。
    for (const objectName of WEB_RUNTIME_GLOBAL_OBJECT_NAMES) {
      defaultInject[`${objectName}.${target}`] = mapping
    }
  }
  const inject = mergeWebRuntimeNativeInject(defaultInject, userInject)
  const isUserOverride = (target: string) => Boolean(
    userInject
    && Object.hasOwn(userInject, target)
    && userInject[target] !== undefined,
  )
  // bindings 模块只转发真实导入；用户覆盖与全局桥接各自建立普通模块依赖。
  const defaultBindingTargets = moduleBindingTargets.filter(target => !isUserOverride(target))
  const runtimeModuleId = resolveNativeRequestGlobalsRuntimeModuleId()
  const code = [
    ...(networkDefaults !== undefined
      ? [`import { setMiniProgramNetworkDefaults } from ${JSON.stringify(runtimeModuleId)}`]
      : []),
    ...(defaultBindingTargets.length > 0
      ? [
          ...defaultBindingTargets.map((target) => {
            const exportedName = NATIVE_TARGET_EXPORTS[target]
            return exportedName === target
              ? `import { ${target} } from ${JSON.stringify(runtimeModuleId)}`
              : `import { ${exportedName} as ${target} } from ${JSON.stringify(runtimeModuleId)}`
          }),
          `export { ${defaultBindingTargets.join(', ')} }`,
        ]
      : []),
    ...(networkDefaults !== undefined
      ? [`setMiniProgramNetworkDefaults(${JSON.stringify(networkDefaults)})`]
      : []),
    '',
  ].join('\n')

  return {
    inject,
    code,
    bindingTargets,
    globalTargets: resolvedGlobalTargets,
    ...(userInject ? { userInject } : {}),
  }
}
