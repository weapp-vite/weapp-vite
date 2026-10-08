import type { ScriptScenario } from '../types'

export type ScriptTimingScenario = Extract<ScriptScenario, { kind: 'sfc' }>

export interface ScriptTimingSample {
  output: string
  inputSha256: string
  failed: boolean
  metrics: Record<string, unknown>
  wallMs: number
  cpuMicroseconds: number
  rssAfterBytes: number
}

export interface ScriptTimingReady {
  id: number
  kind: 'ready'
  sourceHashes: Record<string, string>
}

export type ScriptTimingRequest
  = | { id: number, kind: 'compile', scenario: ScriptTimingScenario }
    | { id: number, kind: 'close' }

export type ScriptTimingResponse
  = | ScriptTimingReady
    | { id: number, kind: 'result', result: ScriptTimingSample }
    | { id: number, kind: 'closed' }
    | { id: number, kind: 'error', message: string }
