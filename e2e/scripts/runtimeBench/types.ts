import type { BenchPhaseSummary } from '../../../apps/runtime-bench-vue/src/utils/diagnostics'
import type { BenchHostHeapSnapshot } from './heap'

export interface BenchDiagnostics {
  flushes: number | null
  patchFlushes: number | null
  diffFlushes: number | null
  fallbackFlushes: number | null
  avgPayloadKeys: number | null
  maxPayloadKeys: number | null
  avgPendingPatchKeys: number | null
  maxPendingPatchKeys: number | null
  avgBytes: number | null
  maxBytes: number | null
}

export interface BenchUpdateSample {
  wallMs: number | null
  metricMs: number | null
  computeMs: number | null
  commitMs: number | null
  dispatchMs: number | null
  flushMs: number | null
  setDataCalls: number | null
  setDataDiagnostics: BenchDiagnostics & { fallbackReasons?: Record<string, number> }
  phases?: BenchPhaseSummary
  visible?: { elapsedMs: number, summary: string, cardCount: number, firstCardTitle: string }
  memory?: {
    workerRssBefore: number
    workerRssAfter: number
    hostHeapBytes: number | null
    hostHeapCapability: 'available' | 'unavailable'
    hostHeapBefore: BenchHostHeapSnapshot
    hostHeapAfter: BenchHostHeapSnapshot
  }
}

export interface BenchUpdateSummary {
  wallMsMedian: number | null
  metricMsMedian: number | null
  computeMsMedian: number | null
  commitMsMedian: number | null
  dispatchMsMedian: number | null
  flushMsMedian: number | null
  setDataCallsMedian: number | null
  setDataDiagnosticsMedian: BenchDiagnostics
  fallbackReasons: Record<string, number>
  samples?: BenchUpdateSample[]
}

export interface BenchScenarioSummary {
  wallMsMedian: number | null
  readyMsMedian: number | null
  firstCommitMsMedian: number | null
  samples?: Array<{ wallMs: number, readyMs: number | null, firstCommitMs: number | null }>
}

export interface WorkerResult {
  schemaVersion: 2
  project: string
  preset?: string
  firstScreen: BenchScenarioSummary
  detailNavigation: BenchScenarioSummary
  updateSingleCommit: { diff: BenchUpdateSummary, patch?: BenchUpdateSummary }
  updateMicroCommit: { diff: BenchUpdateSummary, patch?: BenchUpdateSummary }
  workloads?: Record<string, BenchUpdateSummary>
  artifact?: { files: Array<{ path: string, bytes: number }>, totalBytes: number }
  runtime?: { provider: string, systemInfo: unknown, launchMs?: number }
  staticBinding?: { updateSingleCommit: BenchUpdateSummary, updateMicroCommit: BenchUpdateSummary }
}
