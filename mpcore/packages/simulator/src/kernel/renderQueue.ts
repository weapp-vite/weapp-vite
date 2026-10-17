interface RuntimeRenderQueueOptions {
  isClosed: () => boolean
  onError: (error: unknown) => void
  render: () => unknown
}

/** 两类宿主共享提交、错误诊断与等待回调边界，失败批次不自动重试。 */
export class RuntimeRenderQueue {
  private closed = false
  private pending = false
  private running = false
  private readonly callbacks: Array<() => void> = []

  constructor(private readonly options: RuntimeRenderQueueOptions) {}

  close() {
    this.closed = true
    this.pending = false
    this.callbacks.length = 0
  }

  request(callback?: () => void) {
    if (this.isClosed()) {
      return
    }
    if (callback) {
      this.callbacks.push(callback)
    }
    if (this.pending) {
      return
    }
    this.pending = true
    if (this.running) {
      return
    }
    Promise.resolve().then(async () => {
      if (this.isClosed()) {
        return
      }
      this.pending = false
      this.running = true
      const callbacks = this.callbacks.splice(0)
      try {
        const rendered = this.options.render()
        // Node 同步提交不增加 await；浏览器仍等待真实宿主提交后再派发回调。
        if (rendered && typeof (rendered as PromiseLike<unknown>).then === 'function') {
          await rendered
        }
      }
      catch (error) {
        this.options.onError(error)
        // 失败期间产生的重入请求归入同一失败批次，不能再次执行出错的生命周期。
        callbacks.push(...this.callbacks.splice(0))
        this.pending = false
      }
      finally {
        for (const callback of callbacks) {
          if (this.isClosed()) {
            break
          }
          try {
            callback()
          }
          catch (error) {
            this.options.onError(error)
          }
        }
        this.running = false
        if (this.pending && !this.isClosed()) {
          this.pending = false
          this.request()
        }
      }
    })
  }

  private isClosed() {
    return this.closed || this.options.isClosed()
  }
}
