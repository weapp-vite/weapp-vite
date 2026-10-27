import type {
  MiniProgramErrorCallback,
  ThemeChangeEvent,
  UnhandledRejectionEvent,
} from './types/lifecycle'
import { emitRuntimeWarning } from '../warning'

export type { MiniProgramErrorCallback, ThemeChangeCallback, ThemeChangeEvent, UnhandledRejectionCallback, UnhandledRejectionEvent } from './types/lifecycle'

function createSubscription<NativeEvent extends Event, Payload>(
  name: string,
  eventName: string,
  readPayload: (event: NativeEvent) => Payload,
  resolveTarget: (owner: Window) => EventTarget | MediaQueryList | undefined = owner => owner,
) {
  const listeners = new Set<(payload: Payload) => void>()
  let dispose: (() => void) | undefined
  const emit = (event: Event) => {
    const payload = readPayload(event as NativeEvent)
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
      if (dispose || typeof window === 'undefined') {
        return
      }
      const target = resolveTarget(window)
      if (!target) {
        return
      }
      if (typeof target.addEventListener === 'function') {
        target.addEventListener(eventName, emit)
        dispose = () => target.removeEventListener(eventName, emit)
      }
      else if ('addListener' in target && typeof target.addListener === 'function') {
        target.addListener(emit)
        dispose = () => target.removeListener(emit)
      }
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

const errors = createSubscription('onError', 'error', (event: ErrorEvent) => {
  const error: unknown = event.error
  const stack = error && typeof error === 'object' && 'stack' in error ? error.stack : undefined
  return typeof stack === 'string' && stack ? stack : event.message
})

const rejections = createSubscription(
  'onUnhandledRejection',
  'unhandledrejection',
  (event: PromiseRejectionEvent): UnhandledRejectionEvent => ({ promise: event.promise, reason: event.reason }),
)

const themes = createSubscription(
  'onThemeChange',
  'change',
  (event: MediaQueryListEvent): ThemeChangeEvent => ({ theme: event.matches ? 'dark' : 'light' }),
  owner => typeof owner.matchMedia === 'function' ? owner.matchMedia('(prefers-color-scheme: dark)') : undefined,
)

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
