import type { HmrProfileJsonSample } from '../../packages/weapp-vite/src/analyze/hmr'
import type { HmrProfileSourceEvent } from '../../packages/weapp-vite/src/utils/hmrProfile/provenance'
import type { startDevProcess } from './dev-process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'pathe'
import { readHmrProfileLines } from '../../packages/weapp-vite/src/analyze/hmr/reader'
import { NATIVE_BATCH_SETTLEMENT_PREFIX } from './nativeBatchSettlementPlugin'

type DevProcess = Pick<ReturnType<typeof startDevProcess>, 'getOutput' | 'waitFor'>

interface SourcePublication {
  file: string
  profilePath: string
}

interface SnapshotPublication {
  files: readonly string[]
  profilePath: string
  requestSettlement: (id: string) => void
}

type CompletionOptions = {
  completed: string
  started?: string
  source?: SourcePublication
} | {
  snapshot: SnapshotPublication
}

function normalizedSource(file: string) {
  return path.normalize(file.replaceAll('\\', '/')).replace(/^[A-Z]:/, drive => drive.toLowerCase())
}

function hasSnapshotSources(content: string, files: ReadonlySet<string>, capturedAtEpochMs: number) {
  const observedBySession = new Map<string, Set<string>>()
  let hasAllSources = false
  // 耗时统计 reader 会排除 incomplete/failed；这里只读真实通知溯源，不伪造完成状态或耗时。
  for (const line of content.split(/\r?\n/)) {
    let value: unknown
    try {
      value = JSON.parse(line)
    }
    catch {
      continue
    }
    if (!value || typeof value !== 'object') {
      continue
    }
    const sample = value as Pick<HmrProfileJsonSample, 'schemaVersion' | 'pipeline' | 'status' | 'sessionId' | 'batchId' | 'clock' | 'sourceEvents'>
    if (sample.schemaVersion !== 1 || sample.pipeline !== 'stateful'
      || typeof sample.status !== 'string' || !['complete', 'incomplete', 'failed'].includes(sample.status)
      || typeof sample.sessionId !== 'string' || !sample.sessionId
      || typeof sample.batchId !== 'string' || !sample.batchId
      || !sample.clock || typeof sample.clock !== 'object' || !Array.isArray(sample.sourceEvents)) {
      continue
    }
    const clock = sample.clock
    if (clock.durations !== 'performance.now' || typeof clock.timeOrigin !== 'number'
      || !Number.isFinite(clock.timeOrigin) || clock.timeOrigin <= 0) {
      continue
    }
    let observed = observedBySession.get(sample.sessionId)
    if (!observed) {
      observed = new Set<string>()
      observedBySession.set(sample.sessionId, observed)
    }
    for (const value of sample.sourceEvents) {
      if (!value || typeof value !== 'object') {
        continue
      }
      const event = value as HmrProfileSourceEvent
      if (typeof event.file !== 'string' || typeof event.eventId !== 'string'
        || typeof event.receivedAtMs !== 'number' || !Number.isFinite(event.receivedAtMs) || event.receivedAtMs < 0) {
        continue
      }
      const receivedAtEpochMs = clock.timeOrigin + event.receivedAtMs
      const file = normalizedSource(event.file)
      if (files.has(file) && Number.isFinite(receivedAtEpochMs) && receivedAtEpochMs >= capturedAtEpochMs) {
        if (sample.status === 'failed') {
          throw new Error(`Native batch publication failed for current source: ${event.file}`)
        }
        observed.add(file)
      }
    }
    if (observed.size === files.size) {
      hasAllSources = true
    }
  }
  return hasAllSources
}

function captureSourcePublication(source: SourcePublication | SnapshotPublication) {
  let previousContent = ''
  try {
    previousContent = readFileSync(source.profilePath, 'utf8')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
  // 两个进程的 performance.now() 原点不同；统一换算为 timeOrigin + 毫秒，不能用完成日志时间归因。
  const capturedAtEpochMs = performance.timeOrigin + performance.now()
  const files = new Set(('file' in source ? [source.file] : source.files).map(normalizedSource))
  if (!files.size) {
    throw new Error('Native batch publication requires at least one source file')
  }
  return async (signal: AbortSignal) => {
    let content: string
    try {
      content = await readFile(source.profilePath, { encoding: 'utf8', signal })
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false
      }
      throw error
    }
    // 文件被截断或替换后重新从头读取；事件时钟仍会拒绝旧来源，不沿用失效的字符游标。
    const offset = content.startsWith(previousContent) ? previousContent.length : 0
    // appendFile 尚未写完的行不能成为完成证据；下次仍从同一游标重新读取。
    const completeLines = content.slice(offset, content.lastIndexOf('\n') + 1)
    if ('files' in source) {
      return hasSnapshotSources(completeLines, files, capturedAtEpochMs)
    }
    const { samples } = readHmrProfileLines(completeLines)
    return samples.some(sample => sample.schemaVersion === 1
      && sample.status === 'complete'
      && sample.correlation === 'known'
      && Boolean(sample.buildId && sample.batchId)
      && sample.clock?.durations === 'performance.now'
      && Number.isFinite(sample.clock.timeOrigin)
      && sample.clock.timeOrigin > 0
      && sample.sourceEvents?.some(event => event.file
        && files.has(normalizedSource(event.file))
        && sample.clock!.timeOrigin + event.receivedAtMs >= capturedAtEpochMs))
  }
}

function captureSnapshotPublication(snapshot: SnapshotPublication) {
  const sourcesObserved = captureSourcePublication(snapshot)
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
    const observed = await sourcesObserved(signal)
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

/** 在编辑前记录游标；文件提前可见或上一轮完成日志都不能代替本轮发布完成。 */
export function createDevBuildCompletion(dev: DevProcess, options: CompletionOptions) {
  const offset = dev.getOutput().length
  const sourcePublished = 'source' in options && options.source && captureSourcePublication(options.source)
  const snapshotPublished = 'snapshot' in options && captureSnapshotPublication(options.snapshot)
  const description = 'snapshot' in options ? 'native snapshot settlement' : options.completed
  return {
    async wait(timeoutMs = 30_000): Promise<void> {
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
              && (!sourcePublished || await sourcePublished(reads.signal))
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
      const deadline = setTimeout(() => completion.reject(new Error(`Timed out waiting for current dev build: ${description}`)), timeoutMs)
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
