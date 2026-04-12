import { REQUEST_GLOBAL_ACTUALS_KEY, REQUEST_GLOBAL_PLACEHOLDER_KEY } from '@weapp-core/constants'
import { AbortControllerPolyfill, AbortSignalPolyfill } from './abort'
import { fetch as requestGlobalsFetch } from './fetch'
import { HeadersPolyfill, RequestPolyfill, ResponsePolyfill } from './http'
import {
  installRequestGlobalBinding,
  RequestGlobalsEventTarget,
  resolveRequestGlobalsHost,
  resolveRequestGlobalsHosts,
} from './shared'
import { TextDecoderPolyfill, TextEncoderPolyfill } from './textCodec'
import { URLPolyfill, URLSearchParamsPolyfill } from './url'
import { BlobPolyfill, FormDataPolyfill } from './web'
import { WebSocketPolyfill } from './websocket'
import { XMLHttpRequestPolyfill } from './xhr'

export type WeappInjectRequestGlobalsTarget
  = | 'fetch'
    | 'Headers'
    | 'Request'
    | 'Response'
    | 'TextEncoder'
    | 'TextDecoder'
    | 'AbortController'
    | 'AbortSignal'
    | 'XMLHttpRequest'
    | 'WebSocket'

export interface InstallRequestGlobalsOptions {
  targets?: WeappInjectRequestGlobalsTarget[]
}

type WeappRequestGlobalActualTarget = WeappInjectRequestGlobalsTarget | 'URL' | 'URLSearchParams' | 'Blob' | 'FormData'

function hasRequestRuntimeBinaryUsage(targets: WeappInjectRequestGlobalsTarget[]) {
  return targets.some(target => (
    target === 'fetch'
    || target === 'Request'
    || target === 'Response'
    || target === 'XMLHttpRequest'
    || target === 'WebSocket'
  ))
}

function resolveInstallTargets(targets: WeappInjectRequestGlobalsTarget[]) {
  const installTargets: WeappInjectRequestGlobalsTarget[] = [...targets]
  if (hasRequestRuntimeBinaryUsage(targets)) {
    installTargets.push('TextEncoder', 'TextDecoder')
  }
  return [...new Set(installTargets)]
}

function resolveActualBindingTargets(targets: WeappInjectRequestGlobalsTarget[]): WeappRequestGlobalActualTarget[] {
  const bindingTargets: WeappRequestGlobalActualTarget[] = [...targets]
  const needsRequestRuntimeBinarySupport = hasRequestRuntimeBinaryUsage(targets)

  if (needsRequestRuntimeBinarySupport) {
    bindingTargets.push('TextEncoder', 'TextDecoder')
    bindingTargets.push('URL', 'URLSearchParams', 'Blob', 'FormData')
  }

  return [...new Set(bindingTargets)]
}

function isPlaceholderRequestGlobal(value: unknown) {
  return Boolean(
    value
    && typeof value === 'function'
    && (value as Record<string, any>)[REQUEST_GLOBAL_PLACEHOLDER_KEY] === true,
  )
}

function hasUsableConstructor(value: unknown, args: unknown[] = []) {
  if (typeof value !== 'function' || isPlaceholderRequestGlobal(value)) {
    return false
  }

  try {
    Reflect.construct(value, args)
    return true
  }
  catch {
    return false
  }
}

function assignHostGlobal(host: Record<string, any>, key: string, value: unknown) {
  try {
    host[key] = value
    return true
  }
  catch {
    return false
  }
}

function installSingleTarget(host: Record<string, any>, target: WeappInjectRequestGlobalsTarget) {
  if (target === 'fetch') {
    if (typeof host.fetch !== 'function' || isPlaceholderRequestGlobal(host.fetch)) {
      assignHostGlobal(host, 'fetch', requestGlobalsFetch)
    }
    return
  }

  if (target === 'Headers') {
    if (typeof host.Headers !== 'function' || isPlaceholderRequestGlobal(host.Headers)) {
      assignHostGlobal(host, 'Headers', HeadersPolyfill)
    }
    return
  }

  if (target === 'Request') {
    if (typeof host.Request !== 'function' || isPlaceholderRequestGlobal(host.Request)) {
      assignHostGlobal(host, 'Request', RequestPolyfill)
    }
    return
  }

  if (target === 'Response') {
    if (typeof host.Response !== 'function' || isPlaceholderRequestGlobal(host.Response)) {
      assignHostGlobal(host, 'Response', ResponsePolyfill)
    }
    return
  }

  if (target === 'TextEncoder') {
    if (typeof host.TextEncoder !== 'function' || isPlaceholderRequestGlobal(host.TextEncoder)) {
      assignHostGlobal(host, 'TextEncoder', TextEncoderPolyfill)
    }
    return
  }

  if (target === 'TextDecoder') {
    if (typeof host.TextDecoder !== 'function' || isPlaceholderRequestGlobal(host.TextDecoder)) {
      assignHostGlobal(host, 'TextDecoder', TextDecoderPolyfill)
    }
    return
  }

  if (target === 'AbortController') {
    if (typeof host.AbortController !== 'function' || isPlaceholderRequestGlobal(host.AbortController)) {
      assignHostGlobal(host, 'AbortController', AbortControllerPolyfill)
    }
    return
  }

  if (target === 'AbortSignal') {
    if (typeof host.AbortSignal !== 'function' || isPlaceholderRequestGlobal(host.AbortSignal)) {
      assignHostGlobal(host, 'AbortSignal', AbortSignalPolyfill)
    }
    return
  }

  if (target === 'WebSocket') {
    if (typeof host.WebSocket !== 'function' || isPlaceholderRequestGlobal(host.WebSocket)) {
      assignHostGlobal(host, 'WebSocket', WebSocketPolyfill)
    }
    return
  }

  if (target === 'XMLHttpRequest' && (typeof host.XMLHttpRequest !== 'function' || isPlaceholderRequestGlobal(host.XMLHttpRequest))) {
    assignHostGlobal(host, 'XMLHttpRequest', XMLHttpRequestPolyfill)
  }
}

function installUrlGlobals(host: Record<string, any>) {
  if (!hasUsableConstructor(host.URL, ['https://request-globals.invalid'])) {
    assignHostGlobal(host, 'URL', URLPolyfill)
  }
  if (!hasUsableConstructor(host.URLSearchParams, ['client=graphql-request'])) {
    assignHostGlobal(host, 'URLSearchParams', URLSearchParamsPolyfill)
  }
  if (!hasUsableConstructor(host.Blob)) {
    assignHostGlobal(host, 'Blob', BlobPolyfill)
  }
  if (!hasUsableConstructor(host.FormData)) {
    assignHostGlobal(host, 'FormData', FormDataPolyfill)
  }
}

function installGlobalBindingIfNeeded(host: Record<string, any>, target: string) {
  const value = host[target]
  if (value == null) {
    return
  }

  installRequestGlobalBinding(target, value)
}

function ensureRuntimeHostAliases(host: Record<string, any>) {
  for (const alias of ['global', 'self', 'window']) {
    try {
      host[alias] = host
    }
    catch {
    }
    installRequestGlobalBinding(alias, host)
  }
}

function syncWeappViteRequestGlobalsActuals(
  host: Record<string, any>,
  targets: WeappInjectRequestGlobalsTarget[],
) {
  const globalObject = host != null
    && (typeof host === 'object' || typeof host === 'function')
    ? host
    : resolveRequestGlobalsHost()

  let actuals = globalObject[REQUEST_GLOBAL_ACTUALS_KEY]
  if (!actuals || typeof actuals !== 'object') {
    actuals = Object.create(null)
    assignHostGlobal(globalObject, REQUEST_GLOBAL_ACTUALS_KEY, actuals)
  }

  for (const target of resolveActualBindingTargets(targets)) {
    const value = host[target]
    if (value != null) {
      actuals[target] = value
    }
  }
}

/**
 * @description 按需向小程序全局环境注入缺失的请求相关对象。
 */
export function installRequestGlobals(options: InstallRequestGlobalsOptions = {}) {
  const targets = resolveInstallTargets(options.targets ?? [
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
  ])
  const hosts = resolveRequestGlobalsHosts()
  const primaryHost = resolveRequestGlobalsHost()
  const needsUrlGlobals = hasRequestRuntimeBinaryUsage(targets)

  ensureRuntimeHostAliases(primaryHost)

  for (const host of hosts) {
    if (needsUrlGlobals) {
      installUrlGlobals(host)
    }
    for (const target of targets) {
      installSingleTarget(host, target)
    }
  }

  if (needsUrlGlobals) {
    installGlobalBindingIfNeeded(primaryHost, 'URL')
    installGlobalBindingIfNeeded(primaryHost, 'URLSearchParams')
    installGlobalBindingIfNeeded(primaryHost, 'Blob')
    installGlobalBindingIfNeeded(primaryHost, 'FormData')
  }
  for (const target of targets) {
    installGlobalBindingIfNeeded(primaryHost, target)
  }
  syncWeappViteRequestGlobalsActuals(primaryHost, targets)

  return hosts[0]
}

/**
 * @description 仅安装 AbortController 与 AbortSignal 兼容层。
 */
export function installAbortGlobals() {
  const host = installRequestGlobals({
    targets: ['AbortController', 'AbortSignal'],
  })
  return host
}

export {
  AbortControllerPolyfill,
  AbortSignalPolyfill,
  BlobPolyfill,
  requestGlobalsFetch as fetch,
  FormDataPolyfill,
  HeadersPolyfill,
  RequestGlobalsEventTarget,
  RequestPolyfill,
  ResponsePolyfill,
  URLPolyfill,
  URLSearchParamsPolyfill,
  WebSocketPolyfill,
  XMLHttpRequestPolyfill,
}
