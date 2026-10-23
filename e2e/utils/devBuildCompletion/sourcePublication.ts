import type { HmrProfileJsonSample } from '../../../packages/weapp-vite/src/analyze/hmr'
import type { HmrProfileSourceEvent } from '../../../packages/weapp-vite/src/utils/hmrProfile/provenance'
import type { NativePublicationProfileCursor } from '../nativePublication/files'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { readHmrProfileLines } from '../../../packages/weapp-vite/src/analyze/hmr/reader'
import { nativePublicationHash } from '../nativePublication/files'
import { nativeIdentitySources, normalizedSource } from './nativeIdentity'

export interface SourcePublication {
  file?: string
  files?: readonly string[]
  profilePath: string
}

export interface SnapshotPublication {
  files: readonly string[]
  profilePath: string
  requestSettlement: (id: string) => void
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

export function captureSourcePublication(source: SourcePublication | SnapshotPublication, snapshot = false) {
  let previousContent = ''
  try {
    previousContent = readFileSync(source.profilePath, 'utf8')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
  // 旧收据仍用事件时钟拒绝旧来源；携带原生构建身份时改用同轮因果关联。
  const capturedAtEpochMs = performance.timeOrigin + performance.now()
  const files = new Set((('file' in source && source.file) ? [source.file] : source.files ?? []).map(normalizedSource))
  if (!files.size) {
    throw new Error('Native batch publication requires at least one source file')
  }
  let profileStatus = 'not-read'
  let samples: HmrProfileJsonSample[] = []
  const check = async (signal: AbortSignal, profileCursor?: NativePublicationProfileCursor) => {
    let content: string
    try {
      content = await readFile(source.profilePath, { encoding: 'utf8', signal })
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        profileStatus = 'missing'
        return false
      }
      throw error
    }
    // 文件被截断或替换后重新从头读取；事件时钟仍会拒绝旧来源，不沿用失效的字符游标。
    let offset = content.startsWith(previousContent) ? previousContent.length : 0
    if (profileCursor) {
      if (content.length < profileCursor.offset || nativePublicationHash(content.slice(0, profileCursor.offset)) !== profileCursor.prefixHash) {
        throw new Error('HMR profile was truncated or replaced after the native byte write')
      }
      offset = Math.max(offset, profileCursor.offset)
    }
    // appendFile 尚未写完的行不能成为完成证据；下次仍从同一游标重新读取。
    const completeLines = content.slice(offset, content.lastIndexOf('\n') + 1)
    profileStatus = 'read'
    if (snapshot) {
      return hasSnapshotSources(completeLines, files, capturedAtEpochMs)
    }
    for (const line of completeLines.split(/\r?\n/)) {
      let value: unknown
      try {
        value = JSON.parse(line)
      }
      catch {
        continue
      }
      if (profileCursor?.identity) {
        if (value && typeof value === 'object' && 'status' in value && value.status === 'failed'
          && nativeIdentitySources(value, profileCursor.identity, files).size) {
          throw new Error('Current source publication failed; preserve the original dev build error')
        }
        continue
      }
      if (profileCursor && value && typeof value === 'object' && 'status' in value && value.status === 'failed'
        && 'clock' in value && value.clock && typeof value.clock === 'object' && 'timeOrigin' in value.clock && typeof value.clock.timeOrigin === 'number'
        && 'sourceEvents' in value && Array.isArray(value.sourceEvents)) {
        const timeOrigin = value.clock.timeOrigin
        if (value.sourceEvents.some((event: unknown) => event && typeof event === 'object'
          && 'file' in event && typeof event.file === 'string' && files.has(normalizedSource(event.file))
          && 'receivedAtMs' in event && typeof event.receivedAtMs === 'number' && Number.isFinite(event.receivedAtMs)
          && Number.isFinite(timeOrigin + event.receivedAtMs) && timeOrigin + event.receivedAtMs >= capturedAtEpochMs)) {
          throw new Error('Current source publication failed; preserve the original dev build error')
        }
      }
    }
    samples = readHmrProfileLines(completeLines).samples
    const published = new Set<string>()
    for (const sample of samples.filter(sample => sample.schemaVersion === 1
      && sample.status === 'complete'
      && sample.correlation === 'known'
      && Boolean(sample.buildId && sample.batchId)
      && sample.clock?.durations === 'performance.now'
      && Number.isFinite(sample.clock.timeOrigin)
      && sample.clock.timeOrigin > 0)) {
      if (profileCursor?.identity) {
        for (const file of nativeIdentitySources(sample, profileCursor.identity, files)) {
          published.add(file)
        }
        continue
      }
      for (const event of sample.sourceEvents ?? []) {
        if (event.file && files.has(normalizedSource(event.file)) && Number.isFinite(event.receivedAtMs)
          && Number.isFinite(sample.clock!.timeOrigin + event.receivedAtMs) && sample.clock!.timeOrigin + event.receivedAtMs >= capturedAtEpochMs) {
          published.add(normalizedSource(event.file))
        }
      }
    }
    return published.size === files.size
  }
  return {
    check,
    diagnostics: () => JSON.stringify({
      ...('file' in source && source.file ? { file: normalizedSource(source.file) } : { files: [...files] }),
      capturedAtEpochMs,
      profileStatus,
      samples: samples.slice(-4).map(sample => ({
        status: sample.status,
        correlation: sample.correlation,
        buildId: sample.buildId,
        batchId: sample.batchId,
        clock: sample.clock,
        sourceEvents: sample.sourceEvents,
      })),
    }),
  }
}
