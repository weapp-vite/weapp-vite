import type { SetDataDebugInfo } from 'wevu'

type Phase = NonNullable<SetDataDebugInfo['phase']>

export interface BenchPhaseSummary {
  revisions: number
  dispatches: number
  pending: number
  failed: number
  prepareMs: number | null
  dispatchMs: number | null
  commitMs: number | null
  payloadBytes: number | null
  visibleMs: null
  events: SetDataDebugInfo[]
}

export interface BenchSetDataDiagnosticsSummary {
  flushes: number
  patchFlushes: number
  diffFlushes: number
  fallbackFlushes: number
  fallbackReasons: Record<string, number>
  avgPayloadKeys: number | null
  maxPayloadKeys: number | null
  avgPendingPatchKeys: number | null
  maxPendingPatchKeys: number | null
  avgBytes: number | null
  maxBytes: number | null
  avgComputedDirtyKeys: number | null
  maxComputedDirtyKeys: number | null
  avgMergedSiblingParents: number | null
  maxMergedSiblingParents: number | null
  phases: BenchPhaseSummary
}

export interface BenchSetDataDiagnosticsTracker {
  events: SetDataDebugInfo[]
  flushes: number
}

export function createSetDataDiagnosticsTracker(): BenchSetDataDiagnosticsTracker {
  return { events: [], flushes: 0 }
}

export function resetSetDataDiagnosticsTracker(tracker: BenchSetDataDiagnosticsTracker) {
  tracker.events.length = 0
  tracker.flushes = 0
}

export function recordSetDataDebugEvent(tracker: BenchSetDataDiagnosticsTracker, info: SetDataDebugInfo) {
  tracker.events.push(info)
}

export function recordSetDataFlushEvent(tracker: BenchSetDataDiagnosticsTracker) {
  tracker.flushes += 1
}

function knownSum(values: Array<number | null | undefined>): number | null {
  return values.length && values.every(value => typeof value === 'number' && Number.isFinite(value))
    ? (values as number[]).reduce((sum, value) => sum + value, 0)
    : null
}

function average(values: Array<number | null | undefined>) {
  const total = knownSum(values)
  return total === null ? null : Math.round(total / values.length * 100) / 100
}

function maximum(values: Array<number | null | undefined>) {
  return knownSum(values) === null ? null : Math.max(...values as number[])
}

/** 按 observer/revision 关联阶段，按物理 dispatch 去重；未完成与不可观测不折算为零。 */
export function summarizeSetDataDiagnostics(tracker: BenchSetDataDiagnosticsTracker): BenchSetDataDiagnosticsSummary {
  const events = tracker.events.filter(info => info.phase?.version === 1 && info.revision !== undefined)
  const revisions = new Map<string, { prepare?: SetDataDebugInfo, latest: SetDataDebugInfo }>()
  const dispatches = new Map<number, { info: SetDataDebugInfo, dispatch: NonNullable<Phase['dispatch']>, commit?: Phase }>()
  for (const info of events) {
    const phase = info.phase!
    const key = `${phase.observerId}:${info.revision}`
    const revision = revisions.get(key) ?? { latest: info }
    if (phase.name === 'prepare') {
      revision.prepare = info
    }
    revision.latest = info
    revisions.set(key, revision)
    if (phase.dispatch) {
      const previous = dispatches.get(phase.dispatch.id)
      dispatches.set(phase.dispatch.id, {
        info: previous?.info ?? info,
        dispatch: phase.dispatch,
        commit: phase.name === 'commit' ? phase : previous?.commit,
      })
    }
  }
  const revisionValues = [...revisions.values()]
  const physical = [...dispatches.values()]
  const pending = revisionValues.filter(item => item.latest.phase!.name !== 'commit').length
  const failed = revisionValues.filter(item => item.latest.phase!.name === 'commit' && item.latest.phase!.result !== 'committed').length
  const complete = revisions.size > 0 && !pending && !failed
  const infos = physical.map(item => item.info)
  const bytes = physical.map(item => item.dispatch.payloadBytes)
  const fallbackReasons: Record<string, number> = {}
  for (const info of infos) {
    if (info.reason !== 'patch' && info.reason !== 'diff') {
      fallbackReasons[info.reason] = (fallbackReasons[info.reason] ?? 0) + 1
    }
  }
  return {
    flushes: events.length ? physical.length : tracker.flushes,
    patchFlushes: infos.filter(info => info.mode === 'patch').length,
    diffFlushes: infos.filter(info => info.mode === 'diff').length,
    fallbackFlushes: Object.values(fallbackReasons).reduce((sum, value) => sum + value, 0),
    fallbackReasons,
    avgPayloadKeys: average(infos.map(info => info.payloadKeys)),
    maxPayloadKeys: maximum(infos.map(info => info.payloadKeys)),
    avgPendingPatchKeys: average(infos.map(info => info.pendingPatchKeys)),
    maxPendingPatchKeys: maximum(infos.map(info => info.pendingPatchKeys)),
    avgBytes: average(bytes),
    maxBytes: maximum(bytes),
    avgComputedDirtyKeys: average(infos.map(info => info.computedDirtyKeys)),
    maxComputedDirtyKeys: maximum(infos.map(info => info.computedDirtyKeys)),
    avgMergedSiblingParents: average(infos.map(info => info.mergedSiblingParents)),
    maxMergedSiblingParents: maximum(infos.map(info => info.mergedSiblingParents)),
    phases: {
      revisions: revisions.size,
      dispatches: physical.length,
      pending,
      failed,
      prepareMs: knownSum(revisionValues.map(item => item.prepare?.phase?.prepareDurationMs)),
      dispatchMs: knownSum(physical.map(item => item.dispatch.durationMs)),
      commitMs: complete ? knownSum(physical.map(item => item.commit?.commitDurationMs)) : null,
      payloadBytes: knownSum(bytes),
      visibleMs: null,
      events: events.slice(),
    },
  }
}
