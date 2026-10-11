import type { CompileVueFileOptions } from '../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile'
import type { CompilerObservation } from '../../packages-runtime/wevu-compiler/src/profiling/types'
import type { NativeAnalysisStats } from '../../packages/ast/src/native/observation'
import type { BatchGcObservation } from '../astMigrationProfile/gc'

export const CONTRACT = 'compiler-batch-analysis-v1'
export const PAIRS = 40
export const WARMUP = 2
export type Side = 'off' | 'on'
export type Mode = 'timing' | 'diagnostic' | 'fault'

export interface Fixture {
  id: string
  filename: string
  source: string
  options: CompileVueFileOptions
  autoComponents?: boolean
  expectError?: boolean
  expectParseFallback?: boolean
}

export interface Outcome {
  status: 'success' | 'error'
  warnings: string[]
  value?: unknown
  error?: unknown
}

export interface BatchCounts { calls: number, scripts: number }
export interface Sample {
  id: string
  outcome: Outcome
  errorStack?: string
  outputSha256: string
  wallMs: number
  rssBytes: number
  diagnostic?: {
    compiler: CompilerObservation
    native: NativeAnalysisStats
    compilerBatch: BatchCounts
    gc: Omit<BatchGcObservation, 'scope'> & { scope: 'one independent observed compiler call; warmup and paired timing excluded' }
  }
}

export interface WorkerJob {
  mode: Mode
  side: Side
  fixtures: Fixture[]
  resultFile: string
  diagnosticBinding?: string
}

export interface WorkerResult {
  mode: Mode
  side: Side
  samples: Sample[]
  failure?: string
  rawErrors?: Array<{ id: string, inspection: string }>
}

export interface SummaryWorker {
  mode: Mode
  side: Side
  samples: Array<Omit<Sample, 'outcome' | 'errorStack'>>
}
export interface Pair { pair: number, order: Side[], off: SummaryWorker, on: SummaryWorker }

/** 每对反转执行次序；每个 worker 的固定语料顺序保持一致。 */
export function sideOrder(pair: number): Side[] {
  return pair % 2 ? ['on', 'off'] : ['off', 'on']
}
