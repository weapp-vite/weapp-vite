import type { WebRuntimeGlobalTarget } from '@weapp-core/constants'
import type { MiniProgramNetworkDefaults } from './networkDefaults'
import {
  REQUEST_GLOBAL_ACTUALS_KEY,
  resolveWebRuntimeGlobalTargetDependencies,
} from '@weapp-core/constants'
import { AbortControllerPolyfill, AbortSignalPolyfill } from './abort'
import { atobPolyfill, btoaPolyfill } from './base64'
import { cryptoPolyfill } from './crypto'
import { CustomEventPolyfill, EventPolyfill } from './events'
import { EventSourcePolyfill } from './eventsource'
import { fetch } from './fetch'
import {
  hasUsableConstructor,
  hasUsablePrototypeMethods,
  hasWebCompatibleUrlConstructor,
  patchHeadersConstructor,
  patchResponseConstructor,
  patchUrlConstructor,
  patchUrlSearchParamsConstructor,
} from './globalPatch'
import { isPlaceholderRequestGlobal } from './globalValue'
import { HeadersPolyfill, RequestPolyfill, ResponsePolyfill } from './http'
import { performancePolyfill } from './performance'
import { installRequestGlobalBinding, resolveRequestGlobalsHost, resolveRequestGlobalsHosts } from './shared'
import {
  ReadableStream,
  ReadableStreamPolyfill,
  TextDecoderStreamPolyfill,
  TransformStream,
  WritableStream,
} from './streams'
import { queueMicrotaskPolyfill } from './task'
import { hasUsableTextDecoderConstructor, TextDecoderPolyfill, TextEncoderPolyfill } from './textCodec'
import { URLPolyfill, URLSearchParamsPolyfill } from './url'
import { BlobPolyfill, FilePolyfill, FormDataPolyfill } from './web'
import { WebSocketPolyfill } from './websocket'
import { XMLHttpRequestPolyfill } from './xhr'

export { setMiniProgramNetworkDefaults } from './networkDefaults'

export type WebRuntimeGlobalsHost = Record<string, any>

export interface WebRuntimeInstallContext {
  hosts: WebRuntimeGlobalsHost[]
  primaryHost: WebRuntimeGlobalsHost
}

export interface InstallWebRuntimeGlobalsOptions {
  targets?: readonly WebRuntimeGlobalTarget[]
  networkDefaults?: MiniProgramNetworkDefaults
}

function assignHostGlobal(host: WebRuntimeGlobalsHost, key: string, value: unknown) {
  try {
    host[key] = value
    return true
  }
  catch {
    return false
  }
}

function ensureRuntimeHostAliases(host: WebRuntimeGlobalsHost) {
  for (const alias of ['global', 'self', 'window']) {
    try {
      host[alias] = host
    }
    catch {
    }
    installRequestGlobalBinding(alias, host)
  }
}

/** 创建一次安装共享的宿主上下文，别名只登记一次。 */
export function createWebRuntimeInstallContext(): WebRuntimeInstallContext {
  const hosts = resolveRequestGlobalsHosts()
  const primaryHost = resolveRequestGlobalsHost()
  ensureRuntimeHostAliases(primaryHost)
  return { hosts, primaryHost }
}

/** URL 与二进制数据构造器作为网络运行时的一组依赖安装。 */
export function installWebRuntimeUrlGlobals(context: WebRuntimeInstallContext) {
  for (const host of context.hosts) {
    if (!hasWebCompatibleUrlConstructor(host.URL) || !patchUrlConstructor(host.URL)) {
      assignHostGlobal(host, 'URL', URLPolyfill)
    }
    if (!patchUrlSearchParamsConstructor(host.URLSearchParams)) {
      assignHostGlobal(host, 'URLSearchParams', URLSearchParamsPolyfill)
    }
    if (!hasUsablePrototypeMethods(host.Blob, ['arrayBuffer', 'slice'])) {
      assignHostGlobal(host, 'Blob', BlobPolyfill)
    }
    if (!hasUsablePrototypeMethods(host.File, ['arrayBuffer', 'slice'], ['name'])) {
      assignHostGlobal(host, 'File', FilePolyfill)
    }
    if (!hasUsablePrototypeMethods(host.FormData, ['append', 'entries'])) {
      assignHostGlobal(host, 'FormData', FormDataPolyfill)
    }
  }
}

export function installWebRuntimeFetch(context: WebRuntimeInstallContext) {
  for (const host of context.hosts) {
    if (typeof host.fetch !== 'function' || isPlaceholderRequestGlobal(host.fetch)) {
      assignHostGlobal(host, 'fetch', fetch)
    }
  }
}

export function installWebRuntimeHeaders(context: WebRuntimeInstallContext) {
  for (const host of context.hosts) {
    if (typeof host.Headers !== 'function' || isPlaceholderRequestGlobal(host.Headers) || !patchHeadersConstructor(host.Headers)) {
      assignHostGlobal(host, 'Headers', HeadersPolyfill)
    }
  }
}

export function installWebRuntimeRequest(context: WebRuntimeInstallContext) {
  for (const host of context.hosts) {
    if (typeof host.Request !== 'function' || isPlaceholderRequestGlobal(host.Request)) {
      assignHostGlobal(host, 'Request', RequestPolyfill)
    }
  }
}

export function installWebRuntimeResponse(context: WebRuntimeInstallContext) {
  for (const host of context.hosts) {
    if (typeof host.Response !== 'function' || isPlaceholderRequestGlobal(host.Response) || !patchResponseConstructor(host.Response, ResponsePolyfill)) {
      assignHostGlobal(host, 'Response', ResponsePolyfill)
    }
  }
}

export function installWebRuntimeTextEncoder(context: WebRuntimeInstallContext) {
  for (const host of context.hosts) {
    if (typeof host.TextEncoder !== 'function' || isPlaceholderRequestGlobal(host.TextEncoder)) {
      assignHostGlobal(host, 'TextEncoder', TextEncoderPolyfill)
    }
  }
}

export function installWebRuntimeTextDecoder(context: WebRuntimeInstallContext) {
  for (const host of context.hosts) {
    if (!hasUsableTextDecoderConstructor(host.TextDecoder)) {
      assignHostGlobal(host, 'TextDecoder', TextDecoderPolyfill)
    }
  }
}

export function installWebRuntimeAbortController(context: WebRuntimeInstallContext) {
  for (const host of context.hosts) {
    if (typeof host.AbortController !== 'function' || isPlaceholderRequestGlobal(host.AbortController)) {
      assignHostGlobal(host, 'AbortController', AbortControllerPolyfill)
    }
  }
}

export function installWebRuntimeAbortSignal(context: WebRuntimeInstallContext) {
  for (const host of context.hosts) {
    if (typeof host.AbortSignal !== 'function' || isPlaceholderRequestGlobal(host.AbortSignal)) {
      assignHostGlobal(host, 'AbortSignal', AbortSignalPolyfill)
    }
  }
}

export function installWebRuntimeXMLHttpRequest(context: WebRuntimeInstallContext) {
  for (const host of context.hosts) {
    if (typeof host.XMLHttpRequest !== 'function' || isPlaceholderRequestGlobal(host.XMLHttpRequest)) {
      assignHostGlobal(host, 'XMLHttpRequest', XMLHttpRequestPolyfill)
    }
  }
}

export function installWebRuntimeWebSocket(context: WebRuntimeInstallContext) {
  for (const host of context.hosts) {
    if (typeof host.WebSocket !== 'function' || isPlaceholderRequestGlobal(host.WebSocket)) {
      assignHostGlobal(host, 'WebSocket', WebSocketPolyfill)
    }
  }
}

export function installWebRuntimeAtob(context: WebRuntimeInstallContext) {
  for (const host of context.hosts) {
    if (typeof host.atob !== 'function' || isPlaceholderRequestGlobal(host.atob)) {
      assignHostGlobal(host, 'atob', atobPolyfill)
    }
  }
}

export function installWebRuntimeBtoa(context: WebRuntimeInstallContext) {
  for (const host of context.hosts) {
    if (typeof host.btoa !== 'function' || isPlaceholderRequestGlobal(host.btoa)) {
      assignHostGlobal(host, 'btoa', btoaPolyfill)
    }
  }
}

export function installWebRuntimeQueueMicrotask(context: WebRuntimeInstallContext) {
  for (const host of context.hosts) {
    if (typeof host.queueMicrotask !== 'function' || isPlaceholderRequestGlobal(host.queueMicrotask)) {
      assignHostGlobal(host, 'queueMicrotask', queueMicrotaskPolyfill)
    }
  }
}

export function installWebRuntimePerformance(context: WebRuntimeInstallContext) {
  for (const host of context.hosts) {
    if (!host.performance || isPlaceholderRequestGlobal(host.performance) || typeof host.performance.now !== 'function') {
      assignHostGlobal(host, 'performance', performancePolyfill)
    }
  }
}

export function installWebRuntimeCrypto(context: WebRuntimeInstallContext) {
  for (const host of context.hosts) {
    if (!host.crypto || isPlaceholderRequestGlobal(host.crypto) || typeof host.crypto.getRandomValues !== 'function') {
      assignHostGlobal(host, 'crypto', cryptoPolyfill)
    }
  }
}

export function installWebRuntimeEvent(context: WebRuntimeInstallContext) {
  for (const host of context.hosts) {
    if (typeof host.Event !== 'function' || isPlaceholderRequestGlobal(host.Event)) {
      assignHostGlobal(host, 'Event', EventPolyfill)
    }
  }
}

export function installWebRuntimeCustomEvent(context: WebRuntimeInstallContext) {
  for (const host of context.hosts) {
    if (typeof host.CustomEvent !== 'function' || isPlaceholderRequestGlobal(host.CustomEvent)) {
      assignHostGlobal(host, 'CustomEvent', CustomEventPolyfill)
    }
  }
}

export function installWebRuntimeReadableStream(context: WebRuntimeInstallContext) {
  for (const host of context.hosts) {
    assignHostGlobal(host, 'ReadableStream', ReadableStream)
  }
}

export function installWebRuntimeWritableStream(context: WebRuntimeInstallContext) {
  for (const host of context.hosts) {
    assignHostGlobal(host, 'WritableStream', WritableStream)
  }
}

export function installWebRuntimeTransformStream(context: WebRuntimeInstallContext) {
  for (const host of context.hosts) {
    assignHostGlobal(host, 'TransformStream', TransformStream)
  }
}

export function installWebRuntimeTextDecoderStream(context: WebRuntimeInstallContext) {
  for (const host of context.hosts) {
    if (ReadableStream === ReadableStreamPolyfill || !hasUsableConstructor(host.TextDecoderStream)) {
      assignHostGlobal(host, 'TextDecoderStream', TextDecoderStreamPolyfill)
    }
  }
}

export function installWebRuntimeEventSource(context: WebRuntimeInstallContext) {
  for (const host of context.hosts) {
    if (typeof host.EventSource !== 'function' || isPlaceholderRequestGlobal(host.EventSource)) {
      assignHostGlobal(host, 'EventSource', EventSourcePolyfill)
    }
  }
}

const TARGET_INSTALLERS = {
  fetch: installWebRuntimeFetch,
  Headers: installWebRuntimeHeaders,
  Request: installWebRuntimeRequest,
  Response: installWebRuntimeResponse,
  TextEncoder: installWebRuntimeTextEncoder,
  TextDecoder: installWebRuntimeTextDecoder,
  AbortController: installWebRuntimeAbortController,
  AbortSignal: installWebRuntimeAbortSignal,
  XMLHttpRequest: installWebRuntimeXMLHttpRequest,
  WebSocket: installWebRuntimeWebSocket,
  atob: installWebRuntimeAtob,
  btoa: installWebRuntimeBtoa,
  queueMicrotask: installWebRuntimeQueueMicrotask,
  performance: installWebRuntimePerformance,
  crypto: installWebRuntimeCrypto,
  Event: installWebRuntimeEvent,
  CustomEvent: installWebRuntimeCustomEvent,
  ReadableStream: installWebRuntimeReadableStream,
  WritableStream: installWebRuntimeWritableStream,
  TransformStream: installWebRuntimeTransformStream,
  TextDecoderStream: installWebRuntimeTextDecoderStream,
  EventSource: installWebRuntimeEventSource,
} satisfies Record<WebRuntimeGlobalTarget, (context: WebRuntimeInstallContext) => void>

/** 兼容动态调用方；仅供旧版整体安装路径使用，native 模块绑定不会引用安装器。 */
export function installWebRuntimeTarget(context: WebRuntimeInstallContext, target: WebRuntimeGlobalTarget) {
  TARGET_INSTALLERS[target](context)
}

function hasRequestRuntimeBinaryUsage(targets: readonly WebRuntimeGlobalTarget[]) {
  return targets.some(target => target === 'fetch' || target === 'Request' || target === 'Response' || target === 'XMLHttpRequest' || target === 'WebSocket')
}

function resolveActualBindingTargets(targets: readonly WebRuntimeGlobalTarget[]) {
  const bindingTargets: string[] = [...targets]
  if (hasRequestRuntimeBinaryUsage(targets)) {
    bindingTargets.push('TextEncoder', 'TextDecoder', 'URL', 'URLSearchParams', 'Blob', 'File', 'FormData')
  }
  return [...new Set(bindingTargets)]
}

/** 同步全局绑定与实际值表，保持旧安装器的可观察契约。 */
export function finalizeWebRuntimeInstall(context: WebRuntimeInstallContext, inputTargets: readonly WebRuntimeGlobalTarget[]) {
  const targets = resolveWebRuntimeGlobalTargetDependencies(inputTargets)
  const needsUrlGlobals = hasRequestRuntimeBinaryUsage(targets)
  if (needsUrlGlobals) {
    for (const target of ['URL', 'URLSearchParams', 'Blob', 'File', 'FormData']) {
      const value = context.primaryHost[target]
      if (value != null) {
        installRequestGlobalBinding(target, value)
      }
    }
  }
  for (const target of targets) {
    const value = context.primaryHost[target]
    if (value != null) {
      installRequestGlobalBinding(target, value)
    }
  }

  let actuals = context.primaryHost[REQUEST_GLOBAL_ACTUALS_KEY] as Record<string, unknown> | undefined
  if (!actuals || typeof actuals !== 'object') {
    actuals = Object.create(null) as Record<string, unknown>
    assignHostGlobal(context.primaryHost, REQUEST_GLOBAL_ACTUALS_KEY, actuals)
  }
  for (const target of resolveActualBindingTargets(targets)) {
    const value = context.primaryHost[target]
    if (value != null) {
      actuals[target] = value
    }
  }
  return context.primaryHost
}
