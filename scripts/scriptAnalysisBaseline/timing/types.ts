import type { ScriptVariant } from '../types'

export const TIMING_CORPORA = ['sfc-pressure', 'sfc-retail', 'sfc-wevu'] as const
export type TimingCorpus = typeof TIMING_CORPORA[number]

export interface TimingObservation {
  outputSha256: string
  inputSha256: string
  failed: boolean
  metrics: Record<string, number>
  wallMs: number
  cpuMicroseconds: number
  rssAfterBytes: number
}

export interface TimingReport {
  schemaVersion: 1
  passed: boolean
  failure?: string
  cleanupErrors: string[]
  sourceHashes: Record<string, string>
  sourcesUnchanged: boolean
  scenario: { id: TimingCorpus, filename: string, inputSha256: string, sourceSha256: string }
  batch: number
  requestedIterations: number
  orderPeriod: number
  warmupRounds: number
  completedPairs: number
  startup: Record<ScriptVariant, { sourceHashes: Record<string, string> }>
  checks: Record<ScriptVariant, TimingObservation>
  samples: Array<{ pair: number, order: ScriptVariant[], variants: Record<ScriptVariant, TimingObservation> }>
  environment: { node: string, platform: string, arch: string, cpus: number, startedAt: string, finishedAt: string, initialLoad: number[], finalLoad: number[] }
}

export interface TimingSource {
  id: string
  sha256: string
  report: unknown
}

/** 固定两批三份语料，七个实现的平衡周期为十四轮。 */
export function timingPlan(iterations: number) {
  if (!Number.isSafeInteger(iterations) || iterations <= 0 || iterations % 14 !== 0) {
    throw new Error('Iterations must be a positive multiple of 14')
  }
  return [1, 2].flatMap(batch => TIMING_CORPORA.map(scenario => ({ id: `batch-${batch}-${scenario}`, batch, scenario, iterations })))
}

export const TIMING_LIMITATIONS = [
  'Diagnostic JS baseline experiment only; no Rust implementation is measured or enabled by this tool.',
  'Warm complete compileVueFile calls with fixed options, not cold compilation, Vite/HMR or runtime acceptance.',
  'Each corpus and batch owns seven isolated persistent workers; calls and batches execute serially.',
  'A fourteen-round warmup follows initial correctness; sample order balances positions and immediate predecessors in fourteen-round cycles.',
  'Wall time includes compilation and diagnostic instrumentation; IPC, output serialization/comparison, hashing and metrics snapshots are outside the window.',
  'RSS is the worker snapshot after compilation, not peak or process-tree memory. CPU uses process.cpuUsage and includes all process threads.',
  'Paired savings are reference minus candidate divided by the same pair reference; positive values mean less time.',
  'Do not pool corpora/batches or interpret savings P95 as worst latency. Compare wall-time P95 separately.',
  'Shared runner contention is not independently measured. Cross-platform absolute times are not a controlled OS comparison.',
  'Identity checks cover compiler/diagnostic sources, explicit helper files and lockfile, not every installed dependency file.',
] as const
