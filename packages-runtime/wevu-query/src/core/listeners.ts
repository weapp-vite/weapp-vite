import type { Unsubscribe } from './types'

/** 在不破坏当前状态转换的前提下异步报告调用方回调错误。 */
export function reportCallbackError(error: unknown): void {
  setTimeout(() => {
    throw error
  }, 0)
}

/** 按订阅顺序派发最新值，并隔离重入派发和派发中的取消订阅。 */
export class ListenerStore<TValue> {
  private readonly listeners = new Set<(value: TValue) => void>()
  private notifying = false
  private pending = false
  private pendingValue!: TValue
  private closeWhenIdle = false

  add(listener: (value: TValue) => void): Unsubscribe {
    this.listeners.add(listener)
    let subscribed = true
    return () => {
      if (subscribed) {
        subscribed = false
        this.listeners.delete(listener)
      }
    }
  }

  emit(value: TValue, isCurrent?: () => boolean): void {
    if (this.listeners.size === 0) {
      return
    }
    this.pendingValue = value
    this.pending = true
    if (this.notifying) {
      return
    }

    this.notifying = true
    try {
      do {
        const current = this.pendingValue
        this.pending = false
        const listeners = [...this.listeners]
        for (const listener of listeners) {
          if (this.pending || (isCurrent && !isCurrent())) {
            break
          }
          if (this.listeners.has(listener)) {
            try {
              listener(current)
            }
            catch (error) {
              reportCallbackError(error)
            }
            if (isCurrent && !isCurrent()) {
              break
            }
          }
        }
      } while (this.pending)
    }
    finally {
      this.notifying = false
      if (this.closeWhenIdle) {
        this.finishClose()
      }
    }
  }

  close(value: TValue, isCurrent?: () => boolean): void {
    this.closeWhenIdle = true
    this.emit(value, isCurrent)
    if (!this.notifying && this.closeWhenIdle) {
      this.finishClose()
    }
  }

  clear(): void {
    this.listeners.clear()
    this.pending = false
    this.closeWhenIdle = false
  }

  private finishClose(): void {
    this.listeners.clear()
    this.pending = false
    this.closeWhenIdle = false
  }
}
