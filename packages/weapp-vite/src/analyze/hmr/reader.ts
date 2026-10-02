import type { HmrProfileJsonSample } from '../hmr'

export interface HmrProfileInputCoverage {
  legacy: number
  compatible: number
  incompatible: number
  incomplete: number
  invalid: number
}

const stringFields = ['timestamp', 'eventId', 'event', 'file', 'relativeFile', 'sourceRootFile', 'sessionId', 'buildId', 'batchId']
const collectionFields = ['dirtyReasonSummary', 'pendingReasonSummary']

function isSourceEvent(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const event = value as Record<string, unknown>
  return typeof event.eventId === 'string'
    && (event.file === undefined || typeof event.file === 'string')
    && (event.event === undefined || ['update', 'create', 'delete'].includes(String(event.event)))
    && typeof event.receivedAtMs === 'number' && Number.isFinite(event.receivedAtMs) && event.receivedAtMs >= 0
}

function isSample(value: unknown): value is HmrProfileJsonSample {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const sample = value as Record<string, unknown>
  if (typeof sample.totalMs !== 'number' || !Number.isFinite(sample.totalMs) || sample.totalMs < 0) {
    return false
  }
  if (stringFields.some(key => sample[key] !== undefined && typeof sample[key] !== 'string')) {
    return false
  }
  if (collectionFields.some((key) => {
    const items = sample[key]
    return items !== undefined && (!Array.isArray(items) || items.some(item => typeof item !== 'string'))
  })) {
    return false
  }
  if (sample.sourceEvents !== undefined && (!Array.isArray(sample.sourceEvents) || !sample.sourceEvents.every(isSourceEvent))) {
    return false
  }
  return Object.entries(sample).every(([key, value]) => {
    if (!key.endsWith('Ms') && !key.endsWith('Count')) {
      return true
    }
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
      && (!key.endsWith('Count') || Number.isInteger(value))
  })
}

/** 旧版仍可读取；不兼容、失败和未完成记录不参与正常耗时统计，缺失阶段不补零。 */
export function readHmrProfileLines(content: string) {
  const samples: HmrProfileJsonSample[] = []
  const coverage: HmrProfileInputCoverage = { legacy: 0, compatible: 0, incompatible: 0, incomplete: 0, invalid: 0 }
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) {
      continue
    }
    let value: unknown
    try {
      value = JSON.parse(line)
    }
    catch {
      coverage.invalid += 1
      continue
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      coverage.invalid += 1
      continue
    }
    const record = value as Record<string, unknown>
    if (record.schemaVersion !== undefined && record.schemaVersion !== 1) {
      coverage.incompatible += 1
      continue
    }
    if (record.status === 'incomplete' || record.status === 'failed') {
      coverage.incomplete += 1
      continue
    }
    if ((record.status !== undefined && record.status !== 'complete') || (record.schemaVersion === 1 && record.status !== 'complete') || !isSample(record)) {
      coverage.invalid += 1
      continue
    }
    coverage[record.schemaVersion === undefined ? 'legacy' : 'compatible'] += 1
    samples.push(record)
  }
  return { samples, coverage, skippedLineCount: coverage.incompatible + coverage.incomplete + coverage.invalid }
}
