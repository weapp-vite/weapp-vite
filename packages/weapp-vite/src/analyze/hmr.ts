import { fs } from '@weapp-core/shared/fs'

export interface HmrProfileJsonSample {
  timestamp?: string
  totalMs?: number
  event?: string
  file?: string
  watchToDirtyMs?: number
  emitMs?: number
  sharedChunkResolveMs?: number
  dirtyCount?: number
  pendingCount?: number
  emittedCount?: number
  dirtyReasonSummary?: string[]
  pendingReasonSummary?: string[]
}

export interface HmrProfileMetricSummary {
  count: number
  averageMs?: number
  maxMs?: number
}

export interface HmrProfileCountItem {
  name: string
  count: number
}

export interface HmrProfileAnalyzeResult {
  runtime: 'mini'
  kind: 'hmr-profile'
  generatedAt: string
  profilePath: string
  sampleCount: number
  skippedLineCount: number
  firstTimestamp?: string
  lastTimestamp?: string
  metrics: {
    totalMs: HmrProfileMetricSummary
    watchToDirtyMs: HmrProfileMetricSummary
    emitMs: HmrProfileMetricSummary
    sharedChunkResolveMs: HmrProfileMetricSummary
  }
  events: HmrProfileCountItem[]
  dirtyReasons: HmrProfileCountItem[]
  pendingReasons: HmrProfileCountItem[]
  slowestSamples: HmrProfileJsonSample[]
}

interface AnalyzeHmrProfileOptions {
  profilePath: string
  now?: Date
  topSlowest?: number
}

function createMetricSummary(values: number[]): HmrProfileMetricSummary {
  if (!values.length) {
    return {
      count: 0,
    }
  }
  const total = values.reduce((sum, value) => sum + value, 0)
  return {
    count: values.length,
    averageMs: total / values.length,
    maxMs: Math.max(...values),
  }
}

function sortCountEntries(map: Map<string, number>) {
  return [...map.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([name, count]) => ({ name, count }))
}

function collectCounts(target: Map<string, number>, values?: string[]) {
  for (const value of values ?? []) {
    if (!value) {
      continue
    }
    target.set(value, (target.get(value) ?? 0) + 1)
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * @description 聚合 HMR JSONL profile，为命令行与后续仪表盘复用。
 */
export async function analyzeHmrProfile(options: AnalyzeHmrProfileOptions): Promise<HmrProfileAnalyzeResult> {
  const content = await fs.readFile(options.profilePath, 'utf8')
  const lines = content.split(/\r?\n/)
  const samples: HmrProfileJsonSample[] = []
  let skippedLineCount = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }
    try {
      const parsed = JSON.parse(trimmed) as HmrProfileJsonSample
      if (!isFiniteNumber(parsed.totalMs)) {
        skippedLineCount += 1
        continue
      }
      samples.push(parsed)
    }
    catch {
      skippedLineCount += 1
    }
  }

  const eventCounts = new Map<string, number>()
  const dirtyReasonCounts = new Map<string, number>()
  const pendingReasonCounts = new Map<string, number>()
  const totalValues: number[] = []
  const watchToDirtyValues: number[] = []
  const emitValues: number[] = []
  const sharedChunkValues: number[] = []

  for (const sample of samples) {
    totalValues.push(sample.totalMs!)
    if (sample.event) {
      eventCounts.set(sample.event, (eventCounts.get(sample.event) ?? 0) + 1)
    }
    if (isFiniteNumber(sample.watchToDirtyMs)) {
      watchToDirtyValues.push(sample.watchToDirtyMs)
    }
    if (isFiniteNumber(sample.emitMs)) {
      emitValues.push(sample.emitMs)
    }
    if (isFiniteNumber(sample.sharedChunkResolveMs)) {
      sharedChunkValues.push(sample.sharedChunkResolveMs)
    }
    collectCounts(dirtyReasonCounts, sample.dirtyReasonSummary)
    collectCounts(pendingReasonCounts, sample.pendingReasonSummary)
  }

  const orderedByTime = [...samples].sort((left, right) => {
    const leftTime = typeof left.timestamp === 'string' ? Date.parse(left.timestamp) : Number.NaN
    const rightTime = typeof right.timestamp === 'string' ? Date.parse(right.timestamp) : Number.NaN
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
      return leftTime - rightTime
    }
    return 0
  })
  const slowestSamples = [...samples]
    .sort((left, right) => (right.totalMs ?? 0) - (left.totalMs ?? 0))
    .slice(0, options.topSlowest ?? 5)

  return {
    runtime: 'mini',
    kind: 'hmr-profile',
    generatedAt: (options.now ?? new Date()).toISOString(),
    profilePath: options.profilePath,
    sampleCount: samples.length,
    skippedLineCount,
    firstTimestamp: orderedByTime[0]?.timestamp,
    lastTimestamp: orderedByTime.at(-1)?.timestamp,
    metrics: {
      totalMs: createMetricSummary(totalValues),
      watchToDirtyMs: createMetricSummary(watchToDirtyValues),
      emitMs: createMetricSummary(emitValues),
      sharedChunkResolveMs: createMetricSummary(sharedChunkValues),
    },
    events: sortCountEntries(eventCounts),
    dirtyReasons: sortCountEntries(dirtyReasonCounts),
    pendingReasons: sortCountEntries(pendingReasonCounts),
    slowestSamples,
  }
}
