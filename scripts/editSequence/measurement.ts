import { Buffer } from 'node:buffer'
import process from 'node:process'
import path from 'pathe'

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
    this.loaded.add(path.relative(this.root, id))
  }

  transform(id: string) {
    this.transformCalls++
    this.transformed.add(path.relative(this.root, id))
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
      loadedModules: [...this.loaded].sort(),
      transformCalls: this.transformCalls,
      transformedModules: [...this.transformed].sort(),
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

export interface SequenceMeasurement {
  elapsedMs: number
  process: ReturnType<typeof observeProcessResources>
  build?: ReturnType<SequenceMeasurements['snapshot']>
  session?: { watchers: number, engines: number }
}

export interface SequenceStepResult {
  step: number
  label: string
  status: 'passed' | 'failed'
  incrementalMs?: number
  freshMs?: number
  elapsedMs?: number
  measurement?: SequenceMeasurement
}

/** 至少三个预热后窗口持续上升才触发增长门禁；原始样本仍须保留，不将其称为泄漏证明。 */
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
  const growth = recent[2]! - recent[0]!
  const sustained = recent[1]! > recent[0]! && recent[2]! > recent[1]!
  return { status: sustained && growth > maxGrowth ? 'growth' as const : 'stable' as const, medians, growth }
}
