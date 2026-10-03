import type { StatefulHmrAuditClient, StatefulHmrAuditControl } from './statefulAuditClient'
import type { StatefulHmrAuditEvent } from './statefulAuditUpdate'
import { setTimeout as sleep } from 'node:timers/promises'

interface StatefulArtifactMeasurementOptions<T> {
  client?: StatefulHmrAuditClient
  readControl: (signal?: AbortSignal) => Promise<StatefulHmrAuditControl>
  isCurrentUpdate: (signal?: AbortSignal) => Promise<boolean>
  measure: (signal: AbortSignal) => Promise<T>
  timeoutMs: number
  signal?: AbortSignal
  onEvent?: (event: StatefulHmrAuditEvent) => void
}

function abortable<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    if (signal.aborted) {
      abort()
    }
    else {
      signal.addEventListener('abort', abort, { once: true })
    }
    task.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

/** 产物观察与补丁消费并行；同一游标先确认旧批次，避免后续产物被交付队列阻塞。 */
export async function measureStatefulTemplateArtifact<T>(options: StatefulArtifactMeasurementOptions<T>): Promise<T> {
  const cancellation = new AbortController()
  const signal = options.signal ? AbortSignal.any([options.signal, cancellation.signal]) : cancellation.signal
  signal.throwIfAborted()
  if (!options.client?.supportsExplicitAcknowledgement) {
    return options.measure(signal)
  }
  const deadline = new AbortController()
  const timeoutFailure = new Error('Timed out consuming a stateful HMR batch matching the current template artifact.')
  const deadlineTimer = setTimeout(() => deadline.abort(timeoutFailure), options.timeoutMs)
  const consumerSignal = AbortSignal.any([signal, deadline.signal])
  const consumeUntilCancelled = <R>(task: Promise<R>) => abortable(task, consumerSignal)
  const measurement = abortable((async () => options.measure(signal))(), signal)

  async function readControl() {
    while (true) {
      consumerSignal.throwIfAborted()
      try {
        return await consumeUntilCancelled(options.readControl(consumerSignal))
      }
      catch (error) {
        if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
          throw error
        }
      }
      await consumeUntilCancelled(sleep(25, undefined, { signal: consumerSignal }))
    }
  }

  async function consume() {
    const client = options.client!
    try {
      while (true) {
        consumerSignal.throwIfAborted()
        const control = await readControl()
        // 总期限由同一个 signal 持有；请求计时器不再重新取整剩余时间、争抢截止错误。
        await consumeUntilCancelled(client.ensureRegistered(control, options.timeoutMs, consumerSignal))
        if (!client.supportsExplicitAcknowledgement) {
          return
        }
        const beforeVersion = client.acknowledgedVersion
        const response = await consumeUntilCancelled(client.poll(Math.min(30_000, options.timeoutMs), consumerSignal))
        options.onEvent?.({ type: response.type ?? 'unknown', targetVersion: response.targetVersion })
        if (response.type === 'batch-published') {
          if (response.targetVersion === undefined || response.targetVersion <= beforeVersion) {
            throw new Error('Stateful template consumption requires a newly published batch version.')
          }
          // 下批提交须等当前确认；确认前绑定当前产物，并排除完整重建换代。
          const matches = await consumeUntilCancelled(options.isCurrentUpdate(consumerSignal)).catch((error) => {
            if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
              return false
            }
            throw error
          })
          const current = await readControl()
          if (current.buildId !== control.buildId || current.token !== control.token || current.url !== control.url) {
            continue
          }
          await consumeUntilCancelled(client.acknowledgePublished(options.timeoutMs, consumerSignal))
          if (matches) {
            return
          }
        }
      }
    }
    catch (error) {
      if (error !== timeoutFailure) {
        throw error
      }
    }
    // 原有产物观察仍拥有 marker 超时；不能用传输超时掩盖缺失产物。
    await measurement
    throw timeoutFailure
  }

  const consumption = consume()
  try {
    const [result] = await Promise.all([measurement, consumption])
    return result
  }
  catch (error) {
    cancellation.abort(error)
    throw error
  }
  finally {
    clearTimeout(deadlineTimer)
    cancellation.abort()
    await Promise.allSettled([measurement, consumption])
  }
}
