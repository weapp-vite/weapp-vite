/** 取消后拒绝新工作，删除临时目录前排空完整工作链。 */
export class FixtureLifecycle {
  readonly signal: AbortSignal
  private readonly controller = new AbortController()
  private readonly pending = new Set<Promise<unknown>>()
  private closing?: Promise<void>

  constructor(signal?: AbortSignal) {
    this.signal = signal ? AbortSignal.any([signal, this.controller.signal]) : this.controller.signal
  }

  run<T>(work: () => Promise<T>): Promise<T> {
    const task = Promise.resolve().then(() => {
      this.signal.throwIfAborted()
      return work()
    })
    this.pending.add(task)
    void task.then(() => this.pending.delete(task), () => this.pending.delete(task))
    return task
  }

  close(): Promise<void> {
    if (!this.closing) {
      this.controller.abort(new Error('Fixture is closing'))
      this.closing = Promise.allSettled([...this.pending]).then(() => {})
    }
    return this.closing
  }
}
