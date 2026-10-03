import type { StatefulHmrAuditClient, StatefulHmrAuditControl } from './statefulAuditClient'
import type { StatefulHmrAuditEvent } from './statefulAuditUpdate'
import { performance } from 'node:perf_hooks'
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
  const deadline = performance.now() + options.timeoutMs
  const remaining = () => Math.max(1, Math.ceil(deadline - performance.now()))
  const measurement = abortable((async () => options.measure(signal))(), signal)

  async function readControl() {
    while (performance.now() < deadline) {
      signal.throwIfAborted()
      try {
        return await abortable(options.readControl(signal), signal)
      }
      catch (error) {
        if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
          throw error
        }
      }
      await sleep(Math.min(25, remaining()), undefined, { signal })
    }
  }

  async function consume() {
    const client = options.client!
    try {
      while (performance.now() < deadline) {
        signal.throwIfAborted()
        const control = await readControl()
        if (!control) {
          break
        }
        await abortable(client.ensureRegistered(control, remaining(), signal), signal)
        if (!client.supportsExplicitAcknowledgement) {
          return
        }
        const beforeVersion = client.acknowledgedVersion
        const response = await abortable(client.poll(Math.min(30_000, remaining()), signal), signal)
        options.onEvent?.({ type: response.type ?? 'unknown', targetVersion: response.targetVersion })
        if (response.type === 'batch-published') {
          if (response.targetVersion === undefined || response.targetVersion <= beforeVersion) {
            throw new Error('Stateful template consumption requires a newly published batch version.')
          }
          // 下批提交须等当前确认；确认前绑定当前产物，并排除完整重建换代。
          const matches = await abortable(options.isCurrentUpdate(signal), signal).catch((error) => {
            if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
              return false
            }
            throw error
          })
          const current = await readControl()
          if (!current) {
            break
          }
          if (current.buildId !== control.buildId || current.token !== control.token || current.url !== control.url) {
            continue
          }
          await abortable(client.acknowledgePublished(remaining(), signal), signal)
          if (matches && performance.now() < deadline) {
            return
          }
        }
      }
    }
    catch (error) {
      if (signal.aborted || performance.now() < deadline) {
        throw error
      }
    }
    // 原有产物观察仍拥有 marker 超时；不能用传输超时掩盖缺失产物。
    await measurement
    throw new Error('Timed out consuming a stateful HMR batch matching the current template artifact.')
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
    cancellation.abort()
    await Promise.allSettled([measurement, consumption])
  }
}
