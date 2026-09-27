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
  disposed?: boolean
  committed?: boolean
}

/** 编译结果可以提前准备，资产提交与客户端执行确认必须保持同一条交付链。 */
export class HmrDeliveryCoordinator {
  private generation = 0
  private closed = false
  private pending: QueuedDelivery[] = []
  private running?: Promise<void>
  private failed = false
  private pendingBytes = 0

  constructor(
    private readonly onError: (error: unknown) => void,
    private readonly requestResynchronization?: () => void,
    private readonly maxPending = maxRetainedDeltaCount,
  ) {}

  enqueue(task: HmrDeliveryTask): void {
    if (this.closed) {
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
    this.prepare(item)
    this.pending.push(item)
    this.pendingBytes += task.bytes ?? 0
    this.retry()
  }

  retry(): void {
    this.failed = false
    if (!this.running && !this.closed) {
      this.running = this.drain().finally(() => {
        this.running = undefined
        if (this.pending.length && !this.failed && !this.closed) {
          this.retry()
        }
      })
    }
  }

  reset(): void {
    this.generation += 1
    for (const item of this.pending) {
      void this.dispose(item)
    }
    this.pending = []
    this.pendingBytes = 0
    this.failed = false
  }

  async close(): Promise<void> {
    this.closed = true
    this.reset()
    await this.running
  }

  private prepare(item: QueuedDelivery): Promise<HmrDeliveryPreparation> {
    if (!item.preparation) {
      item.preparation = item.task.prepare()
      void item.preparation.catch(() => {
        item.preparation = undefined
      })
    }
    return item.preparation
  }

  private async dispose(item: QueuedDelivery): Promise<void> {
    if (item.disposed) {
      return
    }
    item.disposed = true
    try {
      await (await item.preparation)?.dispose?.()
    }
    catch {
      // 编译失败由交付循环报告；资源释放不能制造未处理拒绝。
    }
  }

  private async drain(): Promise<void> {
    while (!this.closed && this.pending.length) {
      const item = this.pending[0]!
      try {
        const prepared = await this.prepare(item)
        if (item.generation !== this.generation) {
          continue
        }
        if (!item.committed) {
          await prepared.commit()
          item.committed = true
        }
        if (item.generation !== this.generation) {
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
        if (item.generation === this.generation && !this.closed) {
          this.failed = true
          this.onError(error)
          if (item.generation === this.generation && this.pending.length > 1) {
            this.requestResynchronization?.()
          }
          return
        }
      }
    }
  }
}
