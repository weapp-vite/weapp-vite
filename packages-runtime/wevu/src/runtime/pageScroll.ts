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
  /**
   * 持续滚动时的最大等待时间（毫秒）。
   * 当 trailing 为 false 时，可用于兜底触发一次回调。
   */
  maxWait?: number
}

export type UsePageScrollThrottleStopHandle = () => void

function resolvePositiveInterval(interval: number | undefined): number {
  if (typeof interval !== 'number' || !Number.isFinite(interval)) {
    return 80
  }
  return Math.max(0, interval)
}

function resolveMaxWait(maxWait: number | undefined): number | undefined {
  if (typeof maxWait !== 'number' || !Number.isFinite(maxWait)) {
    return undefined
  }
  return Math.max(0, maxWait)
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
  const maxWait = resolveMaxWait(options.maxWait)

  let trailingTimer: ReturnType<typeof setTimeout> | undefined
  let maxWaitTimer: ReturnType<typeof setTimeout> | undefined
  let stopped = false
  let lastInvokeTime = 0
  let trailingEvent: WechatMiniprogram.Page.IPageScrollOption | undefined

  const clearTrailingTimer = () => {
    if (!trailingTimer) {
      return
    }
    clearTimeout(trailingTimer)
    trailingTimer = undefined
  }

  const clearMaxWaitTimer = () => {
    if (!maxWaitTimer) {
      return
    }
    clearTimeout(maxWaitTimer)
    maxWaitTimer = undefined
  }

  const invoke = (event: WechatMiniprogram.Page.IPageScrollOption) => {
    clearTrailingTimer()
    clearMaxWaitTimer()
    trailingEvent = undefined
    lastInvokeTime = Date.now()
    handler(event)
  }

  const flushTrailing = () => {
    const event = trailingEvent
    trailingEvent = undefined
    trailingTimer = undefined
    if (!event || stopped) {
      return
    }
    invoke(event)
  }

  const flushMaxWait = () => {
    const event = trailingEvent
    maxWaitTimer = undefined
    if (!event || stopped) {
      return
    }
    invoke(event)
  }

  const scheduleTrailing = (now: number) => {
    if (!trailing || trailingTimer) {
      return
    }
    const base = lastInvokeTime === 0 ? now : lastInvokeTime
    const remaining = Math.max(0, interval - (now - base))
    trailingTimer = setTimeout(flushTrailing, remaining)
  }

  const scheduleMaxWait = (now: number) => {
    if (typeof maxWait !== 'number' || maxWaitTimer) {
      return
    }
    const base = lastInvokeTime === 0 ? now : lastInvokeTime
    const remaining = maxWait - (now - base)
    if (remaining <= 0) {
      flushMaxWait()
      return
    }
    maxWaitTimer = setTimeout(flushMaxWait, remaining)
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
    trailingEvent = event

    if (leading && (lastInvokeTime === 0 || now - lastInvokeTime >= interval)) {
      invoke(event)
      return
    }

    if (typeof maxWait === 'number') {
      const base = lastInvokeTime === 0 ? now : lastInvokeTime
      if (now - base >= maxWait) {
        invoke(event)
        return
      }
    }

    if (!trailing && typeof maxWait !== 'number') {
      return
    }

    scheduleTrailing(now)
    scheduleMaxWait(now)
  }

  onPageScroll(register)

  const stop = () => {
    if (stopped) {
      return
    }
    stopped = true
    trailingEvent = undefined
    clearTrailingTimer()
    clearMaxWaitTimer()
  }

  onUnload(stop)
  onDetached(stop)

  return stop
}
