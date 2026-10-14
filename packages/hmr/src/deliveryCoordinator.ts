import { HmrPreparationCleanupError } from './errors'
import { maxRetainedDeltaCount, shouldResetStatefulHmrRetention } from './retention'

export interface HmrDeliveryPreparation {
  commit: () => Promise<void>
  publish: () => Promise<void>
  dispose?: () => void | Promise<void>
}

export interface HmrDeliveryTask {
  bytes?: number
  prepare: () => Promise<HmrDeliveryPreparation>
}

interface QueuedDelivery {
  task: HmrDeliveryTask
  generation: number
  preparation?: Promise<HmrDeliveryPreparation>
  disposal?: Promise<void>
  committed?: boolean
}

/** 编译结果可以提前准备，资产提交与客户端执行确认必须保持同一条交付链。 */
export class HmrDeliveryCoordinator {
  private generation = 0
  private closed = false
  private pending: QueuedDelivery[] = []
  private running?: Promise<void>
  private failed = false
  private failure: unknown
  private revision = 0
  private pendingBytes = 0
  private readonly disposals = new Set<Promise<void>>()
  private readonly disposalFailures: unknown[] = []
  private closing?: Promise<void>

  constructor(
    private readonly onError: (error: unknown) => void,
    private readonly requestResynchronization?: () => void,
    private readonly maxPending = maxRetainedDeltaCount,
  ) {}

  enqueue(task: HmrDeliveryTask): void {
    if (this.closed || this.disposalFailures.length) {
      return
    }
    if (this.failed && this.requestResynchronization) {
      // 新源码不能替换失败批次的固定输入或输出；重新建立基线，避免永久阻塞后续更新。
      this.requestResynchronization()
      return
    }
    if (this.pending.length >= this.maxPending || shouldResetStatefulHmrRetention(0, this.pendingBytes, task.bytes ?? 0)) {
      this.requestResynchronization?.()
      return
    }
    const item: QueuedDelivery = { task, generation: this.generation }
    this.revision += 1
    this.prepare(item)
    this.pending.push(item)
    this.pendingBytes += task.bytes ?? 0
    this.retry()
  }

  retry(): void {
    if (this.closed || this.disposalFailures.length) {
      return
    }
    this.failed = false
    this.failure = undefined
    this.revision += 1
    if (!this.running && !this.closed) {
      this.running = this.drain().finally(() => {
        this.running = undefined
        if (this.pending.length && !this.failed && !this.closed && !this.disposalFailures.length) {
          this.retry()
        }
      })
    }
  }

  reset(): void {
    this.revision += 1
    this.generation += 1
    for (const item of this.pending) {
      void this.dispose(item)
    }
    this.pending = []
    this.pendingBytes = 0
    this.failed = false
    this.failure = undefined
  }

  /** 等待已入队交付及等待期间的新代次；失败向调用方传播，不重试或改变队列。 */
  async whenSettled(): Promise<void> {
    for (;;) {
      const revision = this.revision
      try {
        await this.running
        await this.waitForDisposals()
      }
      catch (error) {
        throw this.failed ? this.failure : error
      }
      this.throwDisposalFailures()
      if (this.failed) {
        throw this.failure
      }
      if (this.closed) {
        throw new Error('HMR delivery coordinator closed before settlement')
      }
      if (revision === this.revision && !this.running && this.pending.length === 0 && this.disposals.size === 0) {
        return
      }
    }
  }

  close(): Promise<void> {
    if (!this.closing) {
      this.closed = true
      this.reset()
      this.closing = (async () => {
        await this.running
        await this.waitForDisposals()
        this.throwDisposalFailures()
      })()
    }
    return this.closing
  }

  private prepare(item: QueuedDelivery): Promise<HmrDeliveryPreparation> {
    if (!item.preparation) {
      item.preparation = item.task.prepare()
      void item.preparation.catch((error) => {
        item.preparation = undefined
        if (error instanceof HmrPreparationCleanupError) {
          this.recordDisposalFailure(error)
        }
      })
    }
    return item.preparation
  }

  private dispose(item: QueuedDelivery): Promise<void> {
    if (item.disposal) {
      return item.disposal
    }
    item.disposal = (async () => {
      let preparation: HmrDeliveryPreparation | undefined
      try {
        preparation = await item.preparation
      }
      catch {
        // 没有准备结果时无资源可释放；编译首错仍由交付循环报告。
        return
      }
      await preparation?.dispose?.()
    })()
    this.disposals.add(item.disposal)
    void item.disposal.then(
      () => this.disposals.delete(item.disposal!),
      (error) => {
        this.disposals.delete(item.disposal!)
        this.recordDisposalFailure(error)
      },
    )
    return item.disposal
  }

  private reportError(error: unknown): void {
    try {
      this.onError(error)
    }
    catch {
      // 诊断回调不能覆盖资源所有者保存的错误或制造未处理拒绝。
    }
  }

  private recordDisposalFailure(error: unknown): void {
    this.disposalFailures.push(error)
    this.reportError(error)
  }

  private async waitForDisposals(): Promise<void> {
    while (this.disposals.size) {
      await Promise.allSettled(this.disposals)
    }
  }

  private throwDisposalFailures(): void {
    if (this.disposalFailures.length === 1) {
      throw this.disposalFailures[0]
    }
    if (this.disposalFailures.length > 1) {
      throw new AggregateError(this.disposalFailures, 'HMR delivery disposal failed', { cause: this.disposalFailures[0] })
    }
  }

  private async drain(): Promise<void> {
    while (!this.closed && !this.disposalFailures.length && this.pending.length) {
      const item = this.pending[0]!
      try {
        const prepared = await this.prepare(item)
        if (item.generation !== this.generation || this.disposalFailures.length) {
          continue
        }
        if (!item.committed) {
          await prepared.commit()
          item.committed = true
        }
        if (item.generation !== this.generation || this.disposalFailures.length) {
          continue
        }
        await prepared.publish()
        if (this.pending[0] === item) {
          this.pending.shift()
          this.pendingBytes -= item.task.bytes ?? 0
        }
        await this.dispose(item)
      }
      catch (error) {
        if (this.disposalFailures.includes(error)) {
          return
        }
        if (item.generation === this.generation && !this.closed) {
          this.failed = true
          this.failure = error
          this.reportError(error)
          if (item.generation === this.generation && this.pending.length > 1) {
            try {
              this.requestResynchronization?.()
            }
            catch (resyncError) {
              this.reportError(resyncError)
            }
          }
          return
        }
      }
    }
  }
}
