import type { SetDataDebugInfo } from 'wevu'
import { describe, expect, it } from 'vitest'
import {
  createSetDataDiagnosticsTracker,
  recordSetDataDebugEvent,
  recordSetDataFlushEvent,
  summarizeSetDataDiagnostics,
} from '../../apps/runtime-bench-vue/src/utils/bench'
import { difference, median, observedNumber } from './runtimeBench/metrics'

function event(name: 'prepare' | 'dispatch' | 'commit', revision = 1): SetDataDebugInfo {
  return {
    mode: 'patch',
    reason: 'patch',
    pendingPatchKeys: 1,
    payloadKeys: 1,
    revision,
    phase: {
      version: 1,
      observerId: 1,
      name,
      result: name === 'commit' ? 'committed' : name === 'prepare' ? 'prepared' : 'pending',
      completion: name === 'commit' ? 'callback' : 'unknown',
      prepareStartedAt: 10,
      preparedAt: 12,
      prepareDurationMs: 2,
      settledAt: name === 'commit' ? 20 : null,
      commitDurationMs: name === 'commit' ? 7 : null,
      visibleAt: null,
      dispatch: name === 'prepare'
        ? null
        : {
            id: 1,
            startedAt: 13,
            returnedAt: 14,
            durationMs: 1,
            payloadBytes: 31,
          },
    },
  }
}

describe('runtime benchmark phase metrics', () => {
  it('preserves zero measurements but never coerces missing or invalid samples to zero', () => {
    expect(observedNumber(0)).toBe(0)
    for (const value of [undefined, null, '', '0', Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(observedNumber(value)).toBeNull()
    }
    expect(median([])).toBeNull()
    expect(median([1, null, 3])).toBeNull()
    expect(median([0, 3])).toBe(1.5)
    expect(difference(4, null)).toBeNull()
  })

  it('keeps absent payload measurements unknown instead of zero', () => {
    const tracker = createSetDataDiagnosticsTracker()
    recordSetDataDebugEvent(tracker, { mode: 'diff', reason: 'diff', payloadKeys: 1, pendingPatchKeys: 0 })
    recordSetDataFlushEvent(tracker)
    expect(summarizeSetDataDiagnostics(tracker).avgBytes).toBeNull()
  })

  it('counts one physical dispatch shared by two revisions once', () => {
    const tracker = createSetDataDiagnosticsTracker()
    for (const revision of [1, 2]) {
      for (const phase of ['prepare', 'dispatch', 'commit'] as const) {
        recordSetDataDebugEvent(tracker, event(phase, revision))
      }
    }
    const summary = summarizeSetDataDiagnostics(tracker)
    expect(summary.flushes).toBe(1)
    expect(summary.avgBytes).toBe(31)
    expect(summary.phases).toMatchObject({ revisions: 2, dispatches: 1, prepareMs: 4, dispatchMs: 1, commitMs: 7, pending: 0, failed: 0, visibleMs: null })
  })

  it('does not infer commit completion from scheduling or an incomplete revision', () => {
    const tracker = createSetDataDiagnosticsTracker()
    recordSetDataDebugEvent(tracker, event('prepare'))
    recordSetDataDebugEvent(tracker, event('dispatch'))
    expect(summarizeSetDataDiagnostics(tracker).phases).toMatchObject({ commitMs: null, pending: 1, visibleMs: null })
  })

  it('keeps failed commits out of successful commit timings and retains evidence', () => {
    const tracker = createSetDataDiagnosticsTracker()
    const failed = event('commit')
    failed.phase!.result = 'failed'
    recordSetDataDebugEvent(tracker, event('prepare'))
    recordSetDataDebugEvent(tracker, event('dispatch'))
    recordSetDataDebugEvent(tracker, failed)
    expect(summarizeSetDataDiagnostics(tracker).phases).toMatchObject({ commitMs: null, pending: 0, failed: 1, events: [event('prepare'), event('dispatch'), failed] })
  })
})
