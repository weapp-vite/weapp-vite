import type { CompileSample, CompileVariant } from '../compileProtocol'

export const CORPORA = ['pressure', 'retail', 'wevu'] as const
export const CORRECTNESS_SCENARIOS = [
  'pressure',
  'wevu',
  'retail',
  'nested-loops',
  'scoped-slots',
  'events-and-repeats',
  'slot-outlet',
  'jsx',
  'unicode-crlf',
  'static-template',
  'fallback-throw',
  'fallback-malformed',
  'invalid-template',
] as const

export interface TimingPlan {
  id: string
  scenario: 'all' | typeof CORPORA[number]
  batch: number
  iterations: number
}

export interface CompilerCheck {
  scenario: string
  filename: string
  sourceSha256: string
  options: Record<string, unknown>
  variants: Record<CompileVariant, { outputSha256: string, failed: boolean, metrics: CompileSample['metrics'] }>
}

export interface CompilerReport {
  schemaVersion: number
  passed: boolean
  failure?: string
  cleanupErrors: string[]
  sourcesUnchanged: boolean
  compilerInputsUnchanged: boolean
  compiler: { compilerSourceFiles: number, compilerSourceTreeSha256: string, lockfileSha256: string, bindingSha256: string }
  toolSources: Record<string, string>
  startup: Record<CompileVariant, { id: number, kind: string, sourceHashes: Record<string, string>, bindingSha256: string }>
  environment: { node: string, platform: string, arch: string, cpus: number, startedAt: string, finishedAt: string, initialLoad: number[], finalLoad: number[] }
  checks: CompilerCheck[]
  requestedIterations: number
  completedPairs: number
  warmupRounds: number
  orderPeriod: number
  fullyBalanced: boolean
  samples: Array<{ pair: number, order: CompileVariant[], variants: Record<CompileVariant, Omit<CompileSample, 'output'>> }>
}

export interface ReportSource {
  id: string
  reportPath: string
  sha256: string
  report: unknown
}

/** 固定两批与语料顺序；每次测量覆盖完整的十轮平衡周期。 */
export function compileTimingPlan(iterations: number): TimingPlan[] {
  if (!Number.isSafeInteger(iterations) || iterations <= 0 || iterations % 10 !== 0) {
    throw new Error('Iterations must be a positive multiple of 10')
  }
  return [
    { id: 'correctness', scenario: 'all', batch: 0, iterations: 0 },
    ...[1, 2].flatMap(batch => CORPORA.map(scenario => ({ id: `batch-${batch}-${scenario}`, scenario, batch, iterations }))),
  ]
}

export const LIMITATIONS = [
  'Shared CI warm compileVueFile calls with fixed options, not cold compilation, Vite builds, HMR or runtime acceptance.',
  'All seven subprocesses run serially; external work and shared-runner resource contention are not independently measured.',
  'Each run owns five isolated persistent workers; each timing run has ten warmup rounds and complete balanced ten-round cycles.',
  'RSS is the worker snapshot immediately after compilation, not peak RSS or total process-tree memory.',
  'Wall timing includes complete compilation and binding planning/analysis/consumption; IPC and output serialization/comparison are excluded.',
  'Paired savings are reference minus candidate; positive values mean less time. Percent savings divide by the same pair reference.',
  'Quantiles use nearest rank independently within each corpus and batch; corpora and repeated batches are not pooled.',
  'Compiler, diagnostic source, native binding and lockfile identities must agree; installed transitive dependency files are not rehashed.',
  'This report does not evaluate the production 10% improvement or 5% regression gates and cannot enable native by default.',
] as const
