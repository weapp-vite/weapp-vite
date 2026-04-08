import { AbortControllerPolyfill, AbortSignalPolyfill } from './abort'
import { fetch as requestGlobalsFetch } from './fetch'
import { HeadersPolyfill, RequestPolyfill, ResponsePolyfill } from './http'
import {
  installRequestGlobalBinding,
  RequestGlobalsEventTarget,
  resolveRequestGlobalsHost,
  resolveRequestGlobalsHosts,
} from './shared'
import { URLPolyfill, URLSearchParamsPolyfill } from './url'
import { BlobPolyfill, FormDataPolyfill } from './web'
import { WebSocketPolyfill } from './websocket'
import { XMLHttpRequestPolyfill } from './xhr'

export type WeappInjectRequestGlobalsTarget
  = | 'fetch'
    | 'Headers'
    | 'Request'
    | 'Response'
    | 'AbortController'
    | 'AbortSignal'
    | 'XMLHttpRequest'
    | 'WebSocket'

export interface InstallRequestGlobalsOptions {
  targets?: WeappInjectRequestGlobalsTarget[]
}

type WeappRequestGlobalActualTarget = WeappInjectRequestGlobalsTarget | 'URL' | 'URLSearchParams' | 'Blob' | 'FormData'

function resolveActualBindingTargets(targets: WeappInjectRequestGlobalsTarget[]): WeappRequestGlobalActualTarget[] {
  const bindingTargets = [...targets]
  const needsUrlGlobals = targets.some(target => (
    target === 'fetch'
    || target === 'Request'
    || target === 'Response'
    || target === 'XMLHttpRequest'
  ))

  if (needsUrlGlobals) {
    bindingTargets.push('URL', 'URLSearchParams', 'Blob', 'FormData')
  }

  return [...new Set(bindingTargets)]
}

function hasUsableConstructor(value: unknown, args: unknown[] = []) {
  if (typeof value !== 'function') {
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

function installSingleTarget(host: Record<string, any>, target: WeappInjectRequestGlobalsTarget) {
  if (target === 'fetch') {
    if (typeof host.fetch !== 'function') {
      host.fetch = requestGlobalsFetch
    }
    return
  }

  if (target === 'Headers') {
    if (typeof host.Headers !== 'function') {
      host.Headers = HeadersPolyfill
    }
    return
  }

  if (target === 'Request') {
    if (typeof host.Request !== 'function') {
      host.Request = RequestPolyfill
    }
    return
  }

  if (target === 'Response') {
    if (typeof host.Response !== 'function') {
      host.Response = ResponsePolyfill
    }
    return
  }

  if (target === 'AbortController') {
    if (typeof host.AbortController !== 'function') {
      host.AbortController = AbortControllerPolyfill
    }
    return
  }

  if (target === 'AbortSignal') {
    if (typeof host.AbortSignal !== 'function') {
      host.AbortSignal = AbortSignalPolyfill
    }
    return
  }

  if (target === 'WebSocket') {
    if (typeof host.WebSocket !== 'function') {
      host.WebSocket = WebSocketPolyfill
    }
    return
  }

  if (target === 'XMLHttpRequest' && typeof host.XMLHttpRequest !== 'function') {
    host.XMLHttpRequest = XMLHttpRequestPolyfill
  }
}

function installUrlGlobals(host: Record<string, any>) {
  if (!hasUsableConstructor(host.URL, ['https://request-globals.invalid'])) {
    host.URL = URLPolyfill
  }
  if (!hasUsableConstructor(host.URLSearchParams, ['client=graphql-request'])) {
    host.URLSearchParams = URLSearchParamsPolyfill
  }
  if (!hasUsableConstructor(host.Blob)) {
    host.Blob = BlobPolyfill
  }
  if (!hasUsableConstructor(host.FormData)) {
    host.FormData = FormDataPolyfill
  }
}

function installGlobalBindingIfNeeded(host: Record<string, any>, target: string) {
  const value = host[target]
  if (value == null) {
    return
  }

  installRequestGlobalBinding(target, value)
}

function syncWeappViteRequestGlobalsActuals(
  host: Record<string, any>,
  targets: WeappInjectRequestGlobalsTarget[],
) {
  const globalObject = resolveRequestGlobalsHost()
  const actuals = globalObject.__weappViteRequestGlobalsActuals
    && typeof globalObject.__weappViteRequestGlobalsActuals === 'object'
    ? globalObject.__weappViteRequestGlobalsActuals
    : (globalObject.__weappViteRequestGlobalsActuals = Object.create(null))

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
  const targets = options.targets ?? [
    'fetch',
    'Headers',
    'Request',
    'Response',
    'AbortController',
    'AbortSignal',
    'XMLHttpRequest',
    'WebSocket',
  ]
  const hosts = resolveRequestGlobalsHosts()
  const primaryHost = resolveRequestGlobalsHost()
  const needsUrlGlobals = targets.some(target => (
    target === 'fetch'
    || target === 'Request'
    || target === 'Response'
    || target === 'XMLHttpRequest'
  ))

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
