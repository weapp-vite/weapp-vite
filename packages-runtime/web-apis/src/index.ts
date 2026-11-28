import type { WebRuntimeGlobalTarget } from '@weapp-core/constants'
import type { MiniProgramNetworkDefaults } from './networkDefaults'
import { REQUEST_GLOBAL_INSTALLER_MARKER, resolveWebRuntimeGlobalTargetDependencies, WEB_RUNTIME_GLOBAL_TARGETS } from '@weapp-core/constants'
import {
  createWebRuntimeInstallContext,
  finalizeWebRuntimeInstall,
  installWebRuntimeTarget,
  installWebRuntimeUrlGlobals,
} from './installers'
import { setMiniProgramNetworkDefaults } from './networkDefaults'

export type WeappInjectWebRuntimeGlobalsTarget = WebRuntimeGlobalTarget

export type WeappInjectRequestGlobalsTarget = WeappInjectWebRuntimeGlobalsTarget

export interface InstallWebRuntimeGlobalsOptions {
  targets?: WeappInjectWebRuntimeGlobalsTarget[]
  networkDefaults?: MiniProgramNetworkDefaults
}

export interface InstallRequestGlobalsOptions extends InstallWebRuntimeGlobalsOptions {}

export { AbortControllerPolyfill, AbortSignalPolyfill } from './abort'

function hasRequestRuntimeBinaryUsage(targets: WeappInjectWebRuntimeGlobalsTarget[]) {
  return targets.some(target => (
    target === 'fetch'
    || target === 'Request'
    || target === 'Response'
    || target === 'XMLHttpRequest'
    || target === 'WebSocket'
  ))
}

/**
 * @description 按需向小程序全局环境注入缺失的 Web Runtime 对象。
 */
export function installWebRuntimeGlobals(options: InstallWebRuntimeGlobalsOptions = {}) {
  if (options.networkDefaults !== undefined) {
    setMiniProgramNetworkDefaults(options.networkDefaults)
  }
  const targets = resolveWebRuntimeGlobalTargetDependencies(options.targets ?? WEB_RUNTIME_GLOBAL_TARGETS)
  const context = createWebRuntimeInstallContext()
  if (hasRequestRuntimeBinaryUsage(targets)) {
    installWebRuntimeUrlGlobals(context)
  }
  for (const target of targets) {
    installWebRuntimeTarget(context, target)
  }
  return finalizeWebRuntimeInstall(context, targets)
}

Object.defineProperty(installWebRuntimeGlobals, REQUEST_GLOBAL_INSTALLER_MARKER, { value: true })

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
  return installWebRuntimeGlobals({
    targets: ['AbortController', 'AbortSignal'],
  })
}

export { atobPolyfill, btoaPolyfill } from './base64'
export { cryptoPolyfill, randomUUIDPolyfill } from './crypto'
export { CustomEventPolyfill, EventPolyfill } from './events'
export { EventSourcePolyfill } from './eventsource'
export { fetch } from './fetch'
export { HeadersPolyfill, RequestPolyfill, ResponsePolyfill } from './http'
export type {
  MiniProgramNetworkDefaults,
  RequestGlobalsMiniProgramOptions,
  WebSocketMiniProgramOptions,
} from './networkDefaults'
export {
  getMiniProgramNetworkDefaults,
  resetMiniProgramNetworkDefaults,
  setMiniProgramNetworkDefaults,
} from './networkDefaults'
export { performancePolyfill } from './performance'
export { RequestGlobalsEventTarget } from './shared'
export { ReadableStream, ReadableStreamPolyfill, TextDecoderStreamPolyfill, TransformStream, TransformStreamPolyfill, WritableStream, WritableStreamPolyfill } from './streams'
export { queueMicrotaskPolyfill } from './task'
export { TextDecoderPolyfill, TextEncoderPolyfill } from './textCodec'
export { URLPolyfill, URLSearchParamsPolyfill } from './url'
export { BlobPolyfill, FilePolyfill, FormDataPolyfill } from './web'
export { WebSocketPolyfill } from './websocket'
export { XMLHttpRequestPolyfill } from './xhr'
