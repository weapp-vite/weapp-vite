type TimeoutHandle = ReturnType<typeof setTimeout>
type IntervalHandle = ReturnType<typeof setInterval>

export class RuntimeScheduler {
  private readonly intervals = new Set<IntervalHandle>()
  private readonly timeouts = new Set<TimeoutHandle>()
  private closed = false
  private canceledHandle?: TimeoutHandle
  private readonly onError: (error: unknown) => void

  constructor(onError: (error: unknown) => void) {
    this.onError = onError
  }

  clearInterval(handle: IntervalHandle) {
    this.intervals.delete(handle)
    clearInterval(handle)
  }

  clearTimeout(handle: TimeoutHandle) {
    this.timeouts.delete(handle)
    clearTimeout(handle)
  }

  close() {
    if (this.closed) {
      return
    }
    this.closed = true
    for (const handle of this.intervals) {
      clearInterval(handle)
    }
    for (const handle of this.timeouts) {
      clearTimeout(handle)
    }
    this.intervals.clear()
    this.timeouts.clear()
  }

  queueMicrotask(handler: () => void) {
    if (this.closed) {
      return
    }
    queueMicrotask(() => {
      if (this.closed) {
        return
      }
      try {
        handler()
      }
      catch (error) {
        this.onError(error)
      }
    })
  }

  setInterval(handler: (...args: any[]) => void, timeout?: number, ...args: any[]) {
    if (this.closed) {
      return this.getCanceledHandle()
    }
    const handle = setInterval(() => {
      try {
        handler(...args)
      }
      catch (error) {
        this.onError(error)
      }
    }, timeout)
    this.intervals.add(handle)
    return handle
  }

  setTimeout(handler: (...args: any[]) => void, timeout?: number, ...args: any[]) {
    if (this.closed) {
      return this.getCanceledHandle()
    }
    const handle = setTimeout(() => {
      this.timeouts.delete(handle)
      try {
        handler(...args)
      }
      catch (error) {
        this.onError(error)
      }
    }, timeout)
    this.timeouts.add(handle)
    return handle
  }

  /** 已销毁 realm 的 Promise 回调不能复活任务，也不能向外泄漏异步拒绝。 */
  private getCanceledHandle(): TimeoutHandle {
    if (!this.canceledHandle) {
      this.canceledHandle = setTimeout(() => {}, 0)
      clearTimeout(this.canceledHandle)
    }
    return this.canceledHandle
  }
}
