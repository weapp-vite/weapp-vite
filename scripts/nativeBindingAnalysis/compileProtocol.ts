import type { CompileVueFileOptions } from '../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/types'
import type { CompileBatchSnapshot } from './compileBatch'

export const COMPILE_VARIANTS = ['baseline', 'control-js', 'planned-js', 'planned-summary', 'planned-native'] as const
export type CompileVariant = typeof COMPILE_VARIANTS[number]

export interface CompileScenario {
  id: string
  filename: string
  source: string
  options: CompileVueFileOptions
  expectError?: boolean
  nativeFault?: 'throw' | 'malformed'
}

export interface CompileSample {
  output: string
  wallMs: number
  cpuMicroseconds: number
  rssAfterBytes: number
  failed: boolean
  metrics: Partial<CompileBatchSnapshot>
}

export type CompileRequest = { id: number, kind: 'compile', scenario: CompileScenario } | { id: number, kind: 'close' }
export type CompileResponse
  = | { id: number, kind: 'ready', sourceHashes: Record<string, string>, bindingSha256?: string }
    | { id: number, kind: 'result', result: CompileSample }
    | { id: number, kind: 'closed' }
    | { id: number, kind: 'error', message: string }
