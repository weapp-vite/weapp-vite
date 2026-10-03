import { bounded } from './driver'

interface ConsumedPublication<T> {
  read: () => T
  delivered: Promise<void>
}

/** 等待真实交付链稳定后才读取观察值；超时交给既有序列边界，不靠固定延迟。 */
export function observeSettledSequencePublication<T>(settle: () => Promise<void>, read: () => T | Promise<T>, signal: AbortSignal): Promise<T> {
  return bounded(async () => {
    await settle()
    signal.throwIfAborted()
    return read()
  }, signal)
}

/** 将运行时消费、引擎确认与原生事务提交分开，供保存序列等待真实发布边界。 */
export class SequencePublicationBarrier<T> {
  private current?: ConsumedPublication<T>
  private next = Promise.withResolvers<ConsumedPublication<T>>()

  consume(read: () => T, delivered: Promise<void>) {
    this.current = { read, delivered }
    this.next.resolve(this.current)
    this.next = Promise.withResolvers<ConsumedPublication<T>>()
  }

  async waitFor(predicate: (observation: T) => boolean, settle: () => Promise<void>, signal: AbortSignal): Promise<T> {
    let publication = this.current
    while (true) {
      if (publication) {
        const observation = publication.read()
        if (predicate(observation)) {
          const delivered = publication.delivered
          // 只由保存方等待 coordinator；原生发布回调不能等待自己的事务结束。
          return observeSettledSequencePublication(async () => {
            await delivered
            await settle()
          }, () => observation, signal)
        }
      }
      publication = await bounded(() => this.next.promise, signal)
    }
  }
}
