interface LaunchStepOptions<T> {
  waitForExit?: boolean
  disposeLate?: (value: T) => void | Promise<void>
}

/** 一次启动独占截止时间和可取消资源；恢复前等待已取消子进程退出。 */
export class AutomatorLaunchLifecycle {
  readonly controller = new AbortController()
  readonly signal = this.controller.signal
  readonly deadlineAt: number
  private readonly pendingExits = new Set<Promise<unknown>>()
  private readonly cleanups = new Set<() => void | Promise<void>>()
  private readonly timeoutError: Error

  constructor(timeoutMs: number, label: string) {
    this.deadlineAt = performance.now() + timeoutMs
    this.timeoutError = new Error(`Timeout in ${label} after ${timeoutMs}ms`)
  }

  throwIfAborted() {
    if (!this.signal.aborted && performance.now() >= this.deadlineAt) {
      this.controller.abort(this.timeoutError)
    }
    this.signal.throwIfAborted()
  }

  remainingMs(cap = Number.POSITIVE_INFINITY) {
    this.throwIfAborted()
    return Math.max(1, Math.min(cap, Math.ceil(this.deadlineAt - performance.now())))
  }

  own(cleanup: () => void | Promise<void>) {
    this.cleanups.add(cleanup)
    this.throwIfAborted()
    return () => this.cleanups.delete(cleanup)
  }

  async step<T>(factory: () => Promise<T>, options: LaunchStepOptions<T> = {}): Promise<T> {
    this.throwIfAborted()
    let removeAbort = () => {}
    const aborted = new Promise<never>((_resolve, reject) => {
      const onAbort = () => reject(this.signal.reason)
      this.signal.addEventListener('abort', onAbort, { once: true })
      removeAbort = () => this.signal.removeEventListener('abort', onAbort)
    })
    const operation = (async () => {
      this.throwIfAborted()
      return await factory()
    })().then(async (value) => {
      try {
        this.throwIfAborted()
      }
      catch (error) {
        await options.disposeLate?.(value)
        throw error
      }
      return value
    })
    if (options.waitForExit) {
      this.pendingExits.add(operation)
    }
    void operation.finally(() => this.pendingExits.delete(operation)).catch(() => {})
    try {
      return await Promise.race([operation, aborted])
    }
    finally {
      removeAbort()
    }
  }

  /** 子阶段保留自己的预算，取消后仍等待底层请求退出，再向外传播失败。 */
  async phase<T>(timeoutMs: number, label: string, factory: (phase: AutomatorLaunchLifecycle) => Promise<T>) {
    const phase = new AutomatorLaunchLifecycle(this.remainingMs(timeoutMs), label)
    const onAbort = () => phase.controller.abort(this.signal.reason)
    this.signal.addEventListener('abort', onAbort, { once: true })
    try {
      return await this.step(
        () => phase.run(() => phase.step(() => factory(phase), { waitForExit: true })),
        { waitForExit: true },
      )
    }
    finally {
      this.signal.removeEventListener('abort', onAbort)
    }
  }

  async pause(ms: number) {
    const duration = Math.min(ms, this.remainingMs())
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await this.step(() => new Promise<void>((resolve) => {
        timer = setTimeout(resolve, duration)
      }))
      this.throwIfAborted()
    }
    finally {
      clearTimeout(timer)
    }
  }

  async run<T>(factory: (lifecycle: AutomatorLaunchLifecycle) => Promise<T>): Promise<T> {
    const timer = setTimeout(() => this.controller.abort(this.timeoutError), this.remainingMs())
    try {
      return await this.step(() => factory(this))
    }
    catch (error) {
      this.controller.abort(error)
      await Promise.allSettled([...this.pendingExits])
      await Promise.allSettled([...this.cleanups].map(cleanup => Promise.resolve().then(cleanup)))
      throw error
    }
    finally {
      clearTimeout(timer)
      this.cleanups.clear()
    }
  }
}
