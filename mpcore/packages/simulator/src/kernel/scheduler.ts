type TimeoutHandle = ReturnType<typeof setTimeout>
type IntervalHandle = ReturnType<typeof setInterval>

export class RuntimeScheduler {
  private readonly intervals = new Set<IntervalHandle>()
  private readonly timeouts = new Set<TimeoutHandle>()
  private closed = false
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
      throw new Error('Cannot schedule work after the runtime session has closed.')
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
      throw new Error('Cannot schedule work after the runtime session has closed.')
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
      throw new Error('Cannot schedule work after the runtime session has closed.')
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
}
