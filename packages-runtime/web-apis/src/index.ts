import type { MiniProgramNetworkDefaults } from './networkDefaults'
import { REQUEST_GLOBAL_ACTUALS_KEY, REQUEST_GLOBAL_PLACEHOLDER_KEY } from '@weapp-core/constants'
import { AbortControllerPolyfill, AbortSignalPolyfill } from './abort'
import { atobPolyfill, btoaPolyfill } from './base64'
import { cryptoPolyfill } from './crypto'
import { CustomEventPolyfill, EventPolyfill } from './events'
import { fetch as requestGlobalsFetch } from './fetch'
import { HeadersPolyfill, RequestPolyfill, ResponsePolyfill } from './http'
import {
  getMiniProgramNetworkDefaults,
  resetMiniProgramNetworkDefaults,
  setMiniProgramNetworkDefaults,
} from './networkDefaults'
import { performancePolyfill } from './performance'
import {
  installRequestGlobalBinding,
  RequestGlobalsEventTarget,
  resolveRequestGlobalsHost,
  resolveRequestGlobalsHosts,
} from './shared'
import { queueMicrotaskPolyfill } from './task'
import { TextDecoderPolyfill, TextEncoderPolyfill } from './textCodec'
import { URLPolyfill, URLSearchParamsPolyfill } from './url'
import { BlobPolyfill, FilePolyfill, FormDataPolyfill } from './web'
import { WebSocketPolyfill } from './websocket'
import { XMLHttpRequestPolyfill } from './xhr'

export type WeappInjectWebRuntimeGlobalsTarget
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
    | 'atob'
    | 'btoa'
    | 'queueMicrotask'
    | 'performance'
    | 'crypto'
    | 'Event'
    | 'CustomEvent'

export type WeappInjectRequestGlobalsTarget = WeappInjectWebRuntimeGlobalsTarget

export interface InstallWebRuntimeGlobalsOptions {
  targets?: WeappInjectWebRuntimeGlobalsTarget[]
  networkDefaults?: MiniProgramNetworkDefaults
}

export interface InstallRequestGlobalsOptions extends InstallWebRuntimeGlobalsOptions {}
export type {
  MiniProgramNetworkDefaults,
  RequestGlobalsMiniProgramOptions,
  WebSocketMiniProgramOptions,
} from './networkDefaults'

type WeappRequestGlobalActualTarget = WeappInjectWebRuntimeGlobalsTarget | 'URL' | 'URLSearchParams' | 'Blob' | 'File' | 'FormData'

function hasRequestRuntimeBinaryUsage(targets: WeappInjectWebRuntimeGlobalsTarget[]) {
  return targets.some(target => (
    target === 'fetch'
    || target === 'Request'
    || target === 'Response'
    || target === 'XMLHttpRequest'
    || target === 'WebSocket'
  ))
}

function resolveInstallTargets(targets: WeappInjectWebRuntimeGlobalsTarget[]) {
  const installTargets: WeappInjectWebRuntimeGlobalsTarget[] = [...targets]
  if (hasRequestRuntimeBinaryUsage(targets)) {
    installTargets.push('TextEncoder', 'TextDecoder')
  }
  if (targets.includes('CustomEvent')) {
    installTargets.push('Event')
  }
  return [...new Set(installTargets)]
}

function resolveActualBindingTargets(targets: WeappInjectWebRuntimeGlobalsTarget[]): WeappRequestGlobalActualTarget[] {
  const bindingTargets: WeappRequestGlobalActualTarget[] = [...targets]
  const needsRequestRuntimeBinarySupport = hasRequestRuntimeBinaryUsage(targets)

  if (needsRequestRuntimeBinarySupport) {
    bindingTargets.push('TextEncoder', 'TextDecoder')
    bindingTargets.push('URL', 'URLSearchParams', 'Blob', 'File', 'FormData')
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

function defineHostGlobal(host: Record<string, any>, key: string, descriptor: PropertyDescriptor) {
  try {
    Object.defineProperty(host, key, {
      configurable: true,
      ...descriptor,
    })
    return true
  }
  catch {
    return false
  }
}

function createUrlParser(URLConstructor: typeof URLPolyfill) {
  return function parse(input: string | URLPolyfill, base?: string | URLPolyfill) {
    try {
      return new URLConstructor(input, base)
    }
    catch {
      return null
    }
  }
}

function createUrlCanParser(URLConstructor: typeof URLPolyfill) {
  return function canParse(input: string | URLPolyfill, base?: string | URLPolyfill) {
    try {
      Reflect.construct(URLConstructor, base === undefined ? [input] : [input, base])
      return true
    }
    catch {
      return false
    }
  }
}

function patchUrlConstructor(host: Record<string, any>) {
  const URLConstructor = host.URL
  if (typeof URLConstructor !== 'function' || isPlaceholderRequestGlobal(URLConstructor)) {
    return false
  }

  let patched = true
  if (typeof URLConstructor.parse !== 'function') {
    patched = assignHostGlobal(URLConstructor, 'parse', createUrlParser(URLConstructor)) && patched
  }
  if (typeof URLConstructor.canParse !== 'function') {
    patched = assignHostGlobal(URLConstructor, 'canParse', createUrlCanParser(URLConstructor)) && patched
  }
  return patched
}

function compareUrlSearchParamKeys(leftKey: string, rightKey: string) {
  if (leftKey < rightKey) {
    return -1
  }
  if (leftKey > rightKey) {
    return 1
  }
  return 0
}

function sortUrlSearchParams(this: URLSearchParams) {
  const entries = Array.from(this.entries()).sort(([leftKey], [rightKey]) => compareUrlSearchParamKeys(leftKey, rightKey))
  const keys = [...new Set(entries.map(([key]) => key))]
  for (const key of keys) {
    this.delete(key)
  }
  for (const [key, value] of entries) {
    this.append(key, value)
  }
}

function patchUrlSearchParamsConstructor(host: Record<string, any>) {
  const URLSearchParamsConstructor = host.URLSearchParams
  const prototype = URLSearchParamsConstructor?.prototype as Record<string, any> | undefined
  if (typeof URLSearchParamsConstructor !== 'function' || isPlaceholderRequestGlobal(URLSearchParamsConstructor) || !prototype) {
    return false
  }

  let patched = true
  if (!('size' in prototype)) {
    patched = defineHostGlobal(prototype, 'size', {
      get(this: URLSearchParams) {
        let size = 0
        this.forEach(() => {
          size += 1
        })
        return size
      },
    }) && patched
  }
  if (typeof prototype.sort !== 'function') {
    patched = assignHostGlobal(prototype, 'sort', sortUrlSearchParams) && patched
  }
  return patched
}

function patchHeadersConstructor(host: Record<string, any>) {
  const HeadersConstructor = host.Headers
  const prototype = HeadersConstructor?.prototype as Record<string, any> | undefined
  if (typeof HeadersConstructor !== 'function' || isPlaceholderRequestGlobal(HeadersConstructor) || !prototype) {
    return false
  }

  if (typeof prototype.getSetCookie === 'function') {
    return true
  }

  return assignHostGlobal(prototype, 'getSetCookie', function getSetCookie(this: Headers) {
    const value = this.get('set-cookie')
    return value == null ? [] : [value]
  })
}

function patchResponseConstructor(host: Record<string, any>) {
  const ResponseConstructor = host.Response
  if (typeof ResponseConstructor !== 'function' || isPlaceholderRequestGlobal(ResponseConstructor)) {
    return false
  }

  let patched = true
  if (typeof ResponseConstructor.json !== 'function') {
    patched = assignHostGlobal(ResponseConstructor, 'json', ResponsePolyfill.json) && patched
  }
  if (typeof ResponseConstructor.error !== 'function') {
    patched = assignHostGlobal(ResponseConstructor, 'error', ResponsePolyfill.error) && patched
  }
  return patched
}

function installSingleTarget(host: Record<string, any>, target: WeappInjectWebRuntimeGlobalsTarget) {
  if (target === 'fetch') {
    if (typeof host.fetch !== 'function' || isPlaceholderRequestGlobal(host.fetch)) {
      assignHostGlobal(host, 'fetch', requestGlobalsFetch)
    }
    return
  }

  if (target === 'Headers') {
    if (typeof host.Headers !== 'function' || isPlaceholderRequestGlobal(host.Headers) || !patchHeadersConstructor(host)) {
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
    if (typeof host.Response !== 'function' || isPlaceholderRequestGlobal(host.Response) || !patchResponseConstructor(host)) {
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

  if (target === 'atob') {
    if (typeof host.atob !== 'function' || isPlaceholderRequestGlobal(host.atob)) {
      assignHostGlobal(host, 'atob', atobPolyfill)
    }
    return
  }

  if (target === 'btoa') {
    if (typeof host.btoa !== 'function' || isPlaceholderRequestGlobal(host.btoa)) {
      assignHostGlobal(host, 'btoa', btoaPolyfill)
    }
    return
  }

  if (target === 'queueMicrotask') {
    if (typeof host.queueMicrotask !== 'function' || isPlaceholderRequestGlobal(host.queueMicrotask)) {
      assignHostGlobal(host, 'queueMicrotask', queueMicrotaskPolyfill)
    }
    return
  }

  if (target === 'performance') {
    if (!host.performance || typeof host.performance.now !== 'function') {
      assignHostGlobal(host, 'performance', performancePolyfill)
    }
    return
  }

  if (target === 'crypto') {
    if (!host.crypto || typeof host.crypto.getRandomValues !== 'function') {
      assignHostGlobal(host, 'crypto', cryptoPolyfill)
    }
    return
  }

  if (target === 'Event') {
    if (typeof host.Event !== 'function' || isPlaceholderRequestGlobal(host.Event)) {
      assignHostGlobal(host, 'Event', EventPolyfill)
    }
    return
  }

  if (target === 'CustomEvent') {
    if (typeof host.CustomEvent !== 'function' || isPlaceholderRequestGlobal(host.CustomEvent)) {
      assignHostGlobal(host, 'CustomEvent', CustomEventPolyfill)
    }
    return
  }

  if (target === 'XMLHttpRequest' && (typeof host.XMLHttpRequest !== 'function' || isPlaceholderRequestGlobal(host.XMLHttpRequest))) {
    assignHostGlobal(host, 'XMLHttpRequest', XMLHttpRequestPolyfill)
  }
}

function installUrlGlobals(host: Record<string, any>) {
  if (!hasUsableConstructor(host.URL, ['https://request-globals.invalid']) || !patchUrlConstructor(host)) {
    assignHostGlobal(host, 'URL', URLPolyfill)
  }
  if (!hasUsableConstructor(host.URLSearchParams, ['client=graphql-request']) || !patchUrlSearchParamsConstructor(host)) {
    assignHostGlobal(host, 'URLSearchParams', URLSearchParamsPolyfill)
  }
  if (!hasUsableConstructor(host.Blob)) {
    assignHostGlobal(host, 'Blob', BlobPolyfill)
  }
  if (!hasUsableConstructor(host.File, [[], 'request-globals.bin'])) {
    assignHostGlobal(host, 'File', FilePolyfill)
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
  targets: WeappInjectWebRuntimeGlobalsTarget[],
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
 * @description 按需向小程序全局环境注入缺失的 Web Runtime 对象。
 */
export function installWebRuntimeGlobals(options: InstallWebRuntimeGlobalsOptions = {}) {
  if (options.networkDefaults !== undefined) {
    setMiniProgramNetworkDefaults(options.networkDefaults)
  }

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
    'atob',
    'btoa',
    'queueMicrotask',
    'performance',
    'crypto',
    'Event',
    'CustomEvent',
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
    installGlobalBindingIfNeeded(primaryHost, 'File')
    installGlobalBindingIfNeeded(primaryHost, 'FormData')
  }
  for (const target of targets) {
    installGlobalBindingIfNeeded(primaryHost, target)
  }
  syncWeappViteRequestGlobalsActuals(primaryHost, targets)

  return hosts[0]
}

/**
 * @description 已废弃，请迁移到 `installWebRuntimeGlobals`。
 */
export function installRequestGlobals(options: InstallRequestGlobalsOptions = {}) {
  return installWebRuntimeGlobals(options)
}

/**
 * @description 仅安装 AbortController 与 AbortSignal 兼容层。
 */
export function installAbortGlobals() {
  const host = installWebRuntimeGlobals({
    targets: ['AbortController', 'AbortSignal'],
  })
  return host
}

export {
  AbortControllerPolyfill,
  AbortSignalPolyfill,
  atobPolyfill,
  BlobPolyfill,
  btoaPolyfill,
  cryptoPolyfill,
  CustomEventPolyfill,
  EventPolyfill,
  requestGlobalsFetch as fetch,
  FilePolyfill,
  FormDataPolyfill,
  getMiniProgramNetworkDefaults,
  HeadersPolyfill,
  performancePolyfill,
  queueMicrotaskPolyfill,
  RequestGlobalsEventTarget,
  RequestPolyfill,
  resetMiniProgramNetworkDefaults,
  ResponsePolyfill,
  setMiniProgramNetworkDefaults,
  TextDecoderPolyfill,
  TextEncoderPolyfill,
  URLPolyfill,
  URLSearchParamsPolyfill,
  WebSocketPolyfill,
  XMLHttpRequestPolyfill,
}
