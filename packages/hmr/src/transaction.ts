export interface HmrBatchIdentity {
  generation: string
  revision: number
}

export interface HmrTransactionOptions<T> {
  identity: HmrBatchIdentity
  prepare: () => T | Promise<T>
  commit: (prepared: T) => Promise<void>
  publish: (prepared: T) => Promise<void>
  dispose?: (prepared: T) => void | Promise<void>
}

/** 可由现有宿主队列调度的单批事务；确认入口不占用或等待该队列。 */
export class HmrTransaction<T> {
  readonly identity: Readonly<HmrBatchIdentity>
  private preparation?: Promise<T>
  private state: 'preparing' | 'prepared' | 'committed' | 'published' | 'applied' | 'disposed' = 'preparing'
  private running?: Promise<void>
  private disposal?: Promise<void>

  constructor(private readonly options: HmrTransactionOptions<T>) {
    this.identity = Object.freeze({ ...options.identity })
    this.prepare()
  }

  get phase() {
    return this.state
  }

  prepare(): Promise<T> {
    if (this.isDisposed()) {
      return Promise.reject(new Error('HMR transaction is disposed'))
    }
    if (!this.preparation) {
      try {
        this.preparation = Promise.resolve(this.options.prepare()).then((value) => {
          if (this.state === 'preparing') {
            this.state = 'prepared'
          }
          return value
        })
      }
      catch (error) {
        this.preparation = Promise.reject(error)
      }
      void this.preparation.catch(() => {
        this.preparation = undefined
      })
    }
    return this.preparation
  }

  publish(): Promise<void> {
    if (this.isDisposed()) {
      return Promise.reject(new Error('HMR transaction is disposed'))
    }
    this.running ??= this.deliver().finally(() => {
      this.running = undefined
    })
    return this.running
  }

  /** 旧代次、未来版本、未发布和重复回报不会推进应用状态。 */
  acknowledge(identity: HmrBatchIdentity): boolean {
    if (identity.generation !== this.identity.generation || identity.revision !== this.identity.revision || this.state !== 'published') {
      return false
    }
    this.state = 'applied'
    return true
  }

  dispose(): Promise<void> {
    this.state = 'disposed'
    this.disposal ??= (async () => {
      await this.running?.catch(() => {})
      if (this.preparation) {
        await this.preparation.then(prepared => this.options.dispose?.(prepared), () => {})
      }
    })()
    return this.disposal
  }

  private isDisposed(): boolean {
    return this.state === 'disposed'
  }

  private async deliver(): Promise<void> {
    const prepared = await this.prepare()
    if (this.state === 'prepared') {
      await this.options.commit(prepared)
      if (this.isDisposed()) {
        return
      }
      this.state = 'committed'
    }
    if (this.state === 'committed') {
      await this.options.publish(prepared)
      if (!this.isDisposed()) {
        this.state = 'published'
      }
    }
  }
}
