import { Buffer } from 'node:buffer'
import { PerformanceObserver } from 'node:perf_hooks'
import process from 'node:process'
import { normalizeSequenceModuleId } from './moduleId'

interface EmittedFile {
  type: 'asset' | 'chunk'
  fileName: string
  source?: string | Uint8Array
  code?: string
}

/** 旁路测量实际 hook 与发布，不把 load 数量冒充框架脏入口数量。 */
export class SequenceMeasurements {
  private loaded = new Set<string>()
  private transformed = new Set<string>()
  private outputs = new Set<string>()
  private loadCalls = 0
  private transformCalls = 0
  private publications = 0
  private outputBytes = 0
  private patches = 0
  private patchBytes = 0

  constructor(private readonly root: string) {}

  reset() {
    this.loaded.clear()
    this.transformed.clear()
    this.outputs.clear()
    this.loadCalls = this.transformCalls = this.publications = this.outputBytes = 0
    this.patches = this.patchBytes = 0
  }

  load(id: string) {
    this.loadCalls++
    this.loaded.add(id)
  }

  transform(id: string) {
    this.transformCalls++
    this.transformed.add(id)
  }

  publish(files: EmittedFile[]) {
    this.publications++
    for (const file of files) {
      this.outputs.add(file.fileName.replaceAll('\\', '/'))
      const content = file.type === 'chunk' ? file.code : file.source
      if (content === undefined) {
        throw new Error(`Missing published content: ${file.fileName}`)
      }
      this.outputBytes += Buffer.byteLength(content)
    }
  }

  patch(code: string) {
    this.patches++
    this.patchBytes += Buffer.byteLength(code)
  }

  snapshot() {
    return {
      loadCalls: this.loadCalls,
      loadedModules: [...this.loaded].map(id => normalizeSequenceModuleId(id, this.root)).sort(),
      transformCalls: this.transformCalls,
      transformedModules: [...this.transformed].map(id => normalizeSequenceModuleId(id, this.root)).sort(),
      publications: this.publications,
      outputFiles: [...this.outputs].sort(),
      outputBytes: this.outputBytes,
      patches: this.patches,
      patchBytes: this.patchBytes,
    }
  }
}

export function observeProcessResources() {
  const resources: Record<string, number> = {}
  for (const type of process.getActiveResourcesInfo()) {
    resources[type] = (resources[type] ?? 0) + 1
  }
  return {
    memory: process.memoryUsage(),
    resources,
    processListeners: Object.fromEntries(process.eventNames().map(name => [String(name), process.listenerCount(name)])),
  }
}

/** 跨过已排队的零延时任务后采样；保留长期计时器，不把瞬时任务误记为滞留资源。 */
export async function sampleProcessResources() {
  // setImmediate 可能早于尚未到期的零延时 timer；新 timer 排在已有同类任务之后。
  await new Promise<void>(resolve => setTimeout(resolve, 0))
  return observeProcessResources()
}

export interface SequenceMeasurement {
  elapsedMs: number
  clock?: { timeOrigin: number, startedAtMs: number, endedAtMs: number }
  process: ReturnType<typeof observeProcessResources>
  build?: ReturnType<SequenceMeasurements['snapshot']>
  session?: { watchers: number, engines: number }
  processTree?: { rssBytes: number, processCount: number, observationMs: number }
  gc?: { count: number, durationMs: number, forced: boolean, observationMs: number }
  outputChanges?: { added: string[], changed: string[], removed: string[], changedBytes: number }
}

/** GC 观测置于编辑计时之后；显式报告强制回收，不能混入普通 HMR 延迟排名。 */
export class SequenceGcObserver {
  private count = 0
  private durationMs = 0
  private readonly observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      this.count++
      this.durationMs += entry.duration
    }
  })

  constructor() {
    this.observer.observe({ entryTypes: ['gc'] })
  }

  async sample(force: boolean) {
    const started = performance.now()
    if (force) {
      if (!globalThis.gc) {
        throw new Error('Resource gates require the worker --expose-gc flag')
      }
      globalThis.gc()
      await new Promise<void>(resolve => setImmediate(resolve))
    }
    for (const entry of this.observer.takeRecords()) {
      this.count++
      this.durationMs += entry.duration
    }
    const result = { count: this.count, durationMs: this.durationMs, forced: force, observationMs: performance.now() - started }
    this.count = this.durationMs = 0
    return result
  }

  close() {
    this.observer.disconnect()
  }
}

export interface SequenceStepResult {
  step: number
  label: string
  status: 'passed' | 'failed'
  incrementalMs?: number
  freshMs?: number
  elapsedMs?: number
  measurement?: SequenceMeasurement
  observationSha256?: string
}

/** 同时检查连续增长与增长后滞留的平台，避免仅比较最后三个窗口而漏掉历史增长。 */
export function evaluateResourceTrend(samples: number[], options: { warmup: number, window: number, maxGrowth: number }) {
  const { warmup, window, maxGrowth } = options
  if (!Number.isInteger(warmup) || warmup < 0 || !Number.isInteger(window) || window < 1 || !Number.isFinite(maxGrowth) || maxGrowth < 0
    || samples.some(value => !Number.isFinite(value) || value < 0)) {
    throw new Error('Resource trends require finite nonnegative samples, warmup and growth limits, and a positive window')
  }
  const medians: number[] = []
  for (let offset = warmup; offset + window <= samples.length; offset += window) {
    const values = samples.slice(offset, offset + window).sort((a, b) => a - b)
    const middle = Math.floor(values.length / 2)
    medians.push(values.length % 2 ? values[middle]! : (values[middle - 1]! + values[middle]!) / 2)
  }
  if (medians.length < 3) {
    return { status: 'unknown' as const, medians, growth: null }
  }
  const recent = medians.slice(-3)
  const growth = medians.at(-1)! - medians[0]!
  const recentGrowth = recent[2]! - recent[0]!
  const sustained = recent[1]! > recent[0]! && recent[2]! > recent[1]!
  const retained = medians.slice(-2).every(value => value - medians[0]! > maxGrowth)
  return { status: (sustained && recentGrowth > maxGrowth) || retained ? 'growth' as const : 'stable' as const, medians, growth, recentGrowth }
}
