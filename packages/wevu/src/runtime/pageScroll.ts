import { getCurrentInstance, onDetached, onPageScroll, onUnload } from './hooks'

export interface UsePageScrollThrottleOptions {
  /**
   * 节流间隔（毫秒），默认 80ms。
   */
  interval?: number
  /**
   * 是否在窗口起始边缘立即触发，默认 true。
   */
  leading?: boolean
  /**
   * 是否在窗口结束边缘补一次回调，默认 true。
   */
  trailing?: boolean
}

export type UsePageScrollThrottleStopHandle = () => void

function resolvePositiveInterval(interval: number | undefined): number {
  if (typeof interval !== 'number' || !Number.isFinite(interval)) {
    return 80
  }
  return Math.max(0, interval)
}

/**
 * 在 setup 中注册节流后的 onPageScroll 监听，并在卸载时自动清理。
 */
export function usePageScrollThrottle(
  handler: (opt: WechatMiniprogram.Page.IPageScrollOption) => void,
  options: UsePageScrollThrottleOptions = {},
): UsePageScrollThrottleStopHandle {
  if (!getCurrentInstance()) {
    throw new Error('usePageScrollThrottle() 必须在 setup() 的同步阶段调用')
  }
  if (typeof handler !== 'function') {
    throw new TypeError('usePageScrollThrottle() 需要传入回调函数')
  }

  const interval = resolvePositiveInterval(options.interval)
  const leading = options.leading ?? true
  const trailing = options.trailing ?? true

  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false
  let lastInvokeTime = 0
  let trailingEvent: WechatMiniprogram.Page.IPageScrollOption | undefined

  const clearTimer = () => {
    if (!timer) {
      return
    }
    clearTimeout(timer)
    timer = undefined
  }

  const invoke = (event: WechatMiniprogram.Page.IPageScrollOption) => {
    lastInvokeTime = Date.now()
    handler(event)
  }

  const flushTrailing = () => {
    const event = trailingEvent
    trailingEvent = undefined
    timer = undefined
    if (!event) {
      return
    }
    invoke(event)
  }

  const register = (event: WechatMiniprogram.Page.IPageScrollOption) => {
    if (stopped) {
      return
    }

    if (interval === 0) {
      invoke(event)
      return
    }

    const now = Date.now()
    if (lastInvokeTime === 0 && !leading) {
      lastInvokeTime = now
    }

    const elapsed = now - lastInvokeTime
    const remaining = interval - elapsed

    if (remaining <= 0 || remaining > interval) {
      clearTimer()
      trailingEvent = undefined
      invoke(event)
      return
    }

    trailingEvent = event
    if (!trailing || timer) {
      return
    }

    timer = setTimeout(flushTrailing, remaining)
  }

  onPageScroll(register)

  const stop = () => {
    if (stopped) {
      return
    }
    stopped = true
    trailingEvent = undefined
    clearTimer()
  }

  onUnload(stop)
  onDetached(stop)

  return stop
}
