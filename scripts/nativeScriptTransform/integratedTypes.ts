import type { DiagnosticError } from '../optimizedCompilerAnalysis/diagnosticError'
import type { OptimizedCompilerExecutionResult } from '../optimizedCompilerAnalysis/execution'
import type { CaptureLoadIdentity } from './captureLoader'
import type { CaptureBridgeMetrics, CapturedValue, CapturedWarning } from './captureTypes'
import type { InlineOriginSnapshot, InlineProvenance } from './origins/types'
import type { NativeTransformOutcome } from './transformNative'

export type IntegratedMode = 'control-js' | 'native'
export interface IntegratedBinding {
  sha256?: string
  invoke?: (source: string, request: string) => unknown
  loadError?: DiagnosticError
}
export interface IntegratedRecord {
  schemaVersion: 1
  scenarioId: string
  callIndex: number
  source: { code: string, sha256: string, utf16Length: number, utf8Bytes: number }
  options?: CapturedValue
  provenance?: InlineProvenance
  request?: string
  rawNative?: CapturedValue
  nativeStatus?: NativeTransformOutcome['status']
  nativeCalls: number
  fallbackCalls: number
  used: 'none' | 'control-js' | 'fallback' | 'native'
  fallbackReason?: string
  nativeError?: DiagnosticError
  requestError?: DiagnosticError
  status: 'active' | 'returned' | 'threw'
  result?: CapturedValue
  error?: DiagnosticError
  warnings: CapturedWarning[]
  bridge: CaptureBridgeMetrics
  evidenceErrors: DiagnosticError[]
}
export interface IntegratedSnapshot {
  mode: IntegratedMode
  bindingSha256?: string
  loadError?: DiagnosticError
  loader: CaptureLoadIdentity
  mapLoader: CaptureLoadIdentity
  origins: InlineOriginSnapshot
  mapComposition: { calls: number, selectiveCalls: number }
  records: IntegratedRecord[]
}
export interface IntegratedCheck extends OptimizedCompilerExecutionResult {
  scenario: string
  iteration: number
  integratedCallIndexes: number[]
}
export interface IntegratedWorkerReport {
  schemaVersion: 1
  variant: IntegratedMode
  passed: boolean
  failure?: DiagnosticError
  cleanupErrors: DiagnosticError[]
  sourceHashesBefore: Record<string, string>
  sourceHashesAfter?: Record<string, string>
  sourcesUnchanged: boolean
  hookSources: Record<string, string>
  bindingSha256Before?: string
  bindingSha256After?: string
  bindingUnchanged: boolean
  checks: IntegratedCheck[]
  integration?: IntegratedSnapshot
  nativeCalls: number
  nativeSucceeded: number
  fallbackCalls: number
  realPages: { scenarioId: string, requiredRecords: number, nativeSucceeded: number, passed: boolean }[]
  scope: string
}
