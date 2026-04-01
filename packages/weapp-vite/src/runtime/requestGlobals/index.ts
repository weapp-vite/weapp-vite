import { fetch as wevuFetch } from 'wevu/fetch'
import { AbortControllerPolyfill, AbortSignalPolyfill } from './abort'
import { HeadersPolyfill, RequestPolyfill, ResponsePolyfill } from './http'
import { resolveRequestGlobalsHost } from './shared'
import { XMLHttpRequestPolyfill } from './xhr'

export type WeappInjectRequestGlobalsTarget
  = | 'fetch'
    | 'Headers'
    | 'Request'
    | 'Response'
    | 'AbortController'
    | 'AbortSignal'
    | 'XMLHttpRequest'

export interface InstallRequestGlobalsOptions {
  targets?: WeappInjectRequestGlobalsTarget[]
}

function installSingleTarget(host: Record<string, any>, target: WeappInjectRequestGlobalsTarget) {
  if (target === 'fetch') {
    if (typeof host.fetch !== 'function') {
      host.fetch = wevuFetch
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

  if (target === 'XMLHttpRequest' && typeof host.XMLHttpRequest !== 'function') {
    host.XMLHttpRequest = XMLHttpRequestPolyfill
  }
}

/**
 * @description 按需向小程序全局环境注入缺失的请求相关对象。
 */
export function installRequestGlobals(options: InstallRequestGlobalsOptions = {}) {
  const host = resolveRequestGlobalsHost()
  const targets = options.targets ?? [
    'fetch',
    'Headers',
    'Request',
    'Response',
    'AbortController',
    'AbortSignal',
    'XMLHttpRequest',
  ]

  for (const target of targets) {
    installSingleTarget(host, target)
  }

  return host
}

export {
  AbortControllerPolyfill,
  AbortSignalPolyfill,
  HeadersPolyfill,
  RequestPolyfill,
  ResponsePolyfill,
  XMLHttpRequestPolyfill,
}
