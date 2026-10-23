import type { startDevProcess } from './dev-process'
import type { SnapshotPublication, SourcePublication } from './devBuildCompletion/sourcePublication'
import type { NativePublicationProfileCursor } from './nativePublication/files'
import { randomUUID } from 'node:crypto'
import { captureSourcePublication } from './devBuildCompletion/sourcePublication'
import { NATIVE_BATCH_SETTLEMENT_PREFIX } from './nativeBatchSettlementPlugin'

type DevProcess = Pick<ReturnType<typeof startDevProcess>, 'getOutput' | 'waitFor'>

type CompletionOptions = {
  completed: string
  started?: string
  source?: SourcePublication
} | {
  source: SourcePublication
} | {
  snapshot: SnapshotPublication
}

function captureSnapshotPublication(snapshot: SnapshotPublication) {
  const sourcesObserved = captureSourcePublication(snapshot, true)
  const id = randomUUID()
  let offset = 0
  let requested = false
  let acknowledged = false
  return async (output: string, signal: AbortSignal) => {
    const end = output.lastIndexOf('\n') + 1
    const lines = output.slice(offset, end).split(/\r?\n/)
    offset = end
    for (const line of lines) {
      const responseAt = line.indexOf(NATIVE_BATCH_SETTLEMENT_PREFIX)
      if (responseAt < 0) {
        continue
      }
      const response: unknown = JSON.parse(line.slice(responseAt + NATIVE_BATCH_SETTLEMENT_PREFIX.length))
      if (!response || typeof response !== 'object'
        || !('id' in response) || typeof response.id !== 'string' || !response.id
        || !('status' in response) || (response.status !== 'complete' && response.status !== 'failed')
        || (response.status === 'failed' && (!('error' in response) || typeof response.error !== 'string'))) {
        throw new Error('Invalid native batch settlement acknowledgement')
      }
      if (requested && response.id === id) {
        if (response.status === 'failed') {
          throw new Error(`Native batch publication failed: ${'error' in response ? response.error : ''}`)
        }
        acknowledged = true
      }
    }
    const observed = await sourcesObserved.check(signal)
    signal.throwIfAborted()
    if (acknowledged) {
      return observed
    }
    if (!requested && observed) {
      requested = true
      // 所有本轮通知已被宿主消费后，从事务外询问唯一 owner；任何 profile 状态都不是空闲证明。
      snapshot.requestSettlement(id)
    }
    return false
  }
}

/** 在编辑前记录游标；仅来源模式以本轮已归因的完成记录为准，不要求通用完成日志。 */
export function createDevBuildCompletion(dev: DevProcess, options: CompletionOptions) {
  const offset = dev.getOutput().length
  const sourcePublished = 'source' in options && options.source && captureSourcePublication(options.source)
  const snapshotPublished = 'snapshot' in options && captureSnapshotPublication(options.snapshot)
  const description = 'snapshot' in options
    ? 'native snapshot settlement'
    : 'completed' in options ? options.completed : 'source profile publication'
  return {
    async wait(timeoutMs = 30_000, profileCursor?: NativePublicationProfileCursor): Promise<void> {
      const completion = Promise.withResolvers<void>()
      const reads = new AbortController()
      let active = true
      let checking = false
      const check = async () => {
        if (!active || checking) {
          return
        }
        checking = true
        try {
          const output = dev.getOutput().slice(offset)
          let published: boolean
          if (snapshotPublished) {
            published = await snapshotPublished(output, reads.signal)
          }
          else if ('completed' in options) {
            const completedAt = output.lastIndexOf(options.completed)
            const startedAt = options.started ? output.lastIndexOf(options.started) : -1
            published = completedAt >= 0 && completedAt > startedAt
              && (!sourcePublished || await sourcePublished.check(reads.signal, profileCursor))
          }
          else if (sourcePublished) {
            published = await sourcePublished.check(reads.signal, profileCursor)
          }
          else {
            published = false
          }
          if (active && published) {
            completion.resolve()
          }
        }
        catch (error) {
          if (active) {
            completion.reject(error)
          }
        }
        finally {
          checking = false
        }
      }
      const interval = setInterval(() => {
        void check()
      }, 25)
      const deadline = setTimeout(() => {
        const diagnostics = sourcePublished ? `\nSource publication: ${sourcePublished.diagnostics()}` : ''
        completion.reject(new Error(`Timed out waiting for current dev build: ${description}${diagnostics}`))
      }, timeoutMs)
      try {
        void check()
        await dev.waitFor(completion.promise, 'current dev build publication')
      }
      finally {
        active = false
        reads.abort()
        clearInterval(interval)
        clearTimeout(deadline)
      }
    },
  }
}
