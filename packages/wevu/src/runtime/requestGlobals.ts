import { getMiniProgramGlobalObject } from './platform'

type RuntimeGlobalsHost = Record<string, any>

function createAbortError(reason?: unknown) {
  if (reason instanceof Error) {
    return reason
  }
  if (typeof DOMException === 'function') {
    return new DOMException('The operation was aborted.', 'AbortError')
  }
  const error = new Error('The operation was aborted.')
  error.name = 'AbortError'
  return error
}

/**
 * 最小 EventTarget 兼容层，仅覆盖 AbortSignal 所需能力。
 */
class RuntimeEventTargetPolyfill {
  private listeners = new Map<string, Set<(event: { type: string }) => void>>()

  addEventListener(type: string, listener: (event: { type: string }) => void) {
    const bucket = this.listeners.get(type) ?? new Set<(event: { type: string }) => void>()
    bucket.add(listener)
    this.listeners.set(type, bucket)
  }

  removeEventListener(type: string, listener: (event: { type: string }) => void) {
    const bucket = this.listeners.get(type)
    bucket?.delete(listener)
    if (bucket && bucket.size === 0) {
      this.listeners.delete(type)
    }
  }

  dispatchEvent(event: { type: string }) {
    const bucket = this.listeners.get(event.type)
    bucket?.forEach(listener => listener(event))
    return true
  }
}

export class AbortSignalPolyfill extends RuntimeEventTargetPolyfill {
  aborted = false
  reason: unknown
  onabort: ((event: { type: string }) => void) | null = null

  throwIfAborted() {
    if (this.aborted) {
      throw createAbortError(this.reason)
    }
  }

  override dispatchEvent(event: { type: string }) {
    super.dispatchEvent(event)
    this.onabort?.(event)
    return true
  }
}

export class AbortControllerPolyfill {
  readonly signal = new AbortSignalPolyfill()

  abort(reason?: unknown) {
    if (this.signal.aborted) {
      return
    }
    this.signal.aborted = true
    this.signal.reason = reason
    this.signal.dispatchEvent({ type: 'abort' })
  }
}

function installAbortGlobalsOnHost(host: RuntimeGlobalsHost | undefined) {
  if (!host) {
    return
  }
  if (typeof host.AbortSignal !== 'function') {
    host.AbortSignal = AbortSignalPolyfill
  }
  if (typeof host.AbortController !== 'function') {
    host.AbortController = AbortControllerPolyfill
  }
}

/**
 * 为小程序 runtime 安装第三方库常用的中止控制器全局对象。
 */
export function installRuntimeAbortGlobals() {
  installAbortGlobalsOnHost(typeof globalThis === 'undefined' ? undefined : globalThis as RuntimeGlobalsHost)
  installAbortGlobalsOnHost(getMiniProgramGlobalObject())
}

installRuntimeAbortGlobals()
