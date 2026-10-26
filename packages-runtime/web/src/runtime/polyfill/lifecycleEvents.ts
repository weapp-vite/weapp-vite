import type {
  MiniProgramErrorCallback,
  ThemeChangeEvent,
  UnhandledRejectionEvent,
} from './types/lifecycle'
import { emitRuntimeWarning } from '../warning'

export type { MiniProgramErrorCallback, ThemeChangeCallback, ThemeChangeEvent, UnhandledRejectionCallback, UnhandledRejectionEvent } from './types/lifecycle'

function createSubscription<Payload>(
  name: string,
  bind: (emit: (payload: Payload) => void) => (() => void) | undefined,
) {
  const listeners = new Set<(payload: Payload) => void>()
  let dispose: (() => void) | undefined
  const emit = (payload: Payload) => {
    for (const listener of [...listeners]) {
      try {
        listener(payload)
      }
      catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        emitRuntimeWarning(`[@weapp-vite/web] ${name} 监听器执行失败：${reason}`, {
          key: `lifecycle-listener:${name}:${reason}`,
          context: 'runtime:lifecycle',
        })
      }
    }
  }
  return {
    on(listener: (payload: Payload) => void): void {
      if (typeof listener !== 'function') {
        return
      }
      listeners.add(listener)
      dispose ??= bind(emit)
    },
    off(listener?: (payload: Payload) => void): void {
      if (listener === undefined) {
        listeners.clear()
      }
      else {
        listeners.delete(listener)
      }
      if (listeners.size === 0) {
        dispose?.()
        dispose = undefined
      }
    },
  }
}

const errors = createSubscription<string>('onError', (emit) => {
  if (typeof window === 'undefined') {
    return
  }
  const target = window
  const listener = (event: ErrorEvent) => {
    const error: unknown = event.error
    const stack = error && typeof error === 'object' && 'stack' in error ? error.stack : undefined
    emit(typeof stack === 'string' && stack ? stack : event.message)
  }
  target.addEventListener('error', listener)
  return () => target.removeEventListener('error', listener)
})

const rejections = createSubscription<UnhandledRejectionEvent>('onUnhandledRejection', (emit) => {
  if (typeof window === 'undefined') {
    return
  }
  const target = window
  const listener = (event: PromiseRejectionEvent) => emit({ promise: event.promise, reason: event.reason })
  target.addEventListener('unhandledrejection', listener)
  return () => target.removeEventListener('unhandledrejection', listener)
})

const themes = createSubscription<ThemeChangeEvent>('onThemeChange', (emit) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return
  }
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const listener = (event: MediaQueryListEvent) => emit({ theme: event.matches ? 'dark' : 'light' })
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }
  if (typeof media.addListener === 'function') {
    media.addListener(listener)
    return () => media.removeListener(listener)
  }
})

/** 监听脚本错误，错误字符串优先保留浏览器提供的堆栈。 */
export const onError: (handler: MiniProgramErrorCallback) => void = errors.on
export const offError: (handler?: MiniProgramErrorCallback) => void = errors.off
export const onUnhandledRejection = rejections.on
export const offUnhandledRejection = rejections.off
export const onThemeChange = themes.on
export const offThemeChange = themes.off

/** Web 不上报微信平台埋点，只按现有告警策略说明能力边界。 */
export function reportEvent(_eventId: string, _data?: Record<string, unknown>): void {
  emitRuntimeWarning('[@weapp-vite/web] wx.reportEvent 在 Web 端仅提供兼容调用，不会上报到微信平台。', {
    key: 'reportEvent',
  })
}
