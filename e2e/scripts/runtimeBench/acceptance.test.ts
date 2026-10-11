import type { BenchDiagnostics, BenchUpdateSummary, WorkerResult } from './types'
import { describe, expect, it } from 'vitest'
import { assessBenchMemory } from './acceptance'
import { heapContext, testInspectorIdentity, testNativeEvidence } from './nativeInspectorHeap/testHelpers'

function resultFixture(): WorkerResult {
  const identity = testInspectorIdentity()
  let sequence = 0
  const diagnostics: BenchDiagnostics = { flushes: null, patchFlushes: null, diffFlushes: null, fallbackFlushes: null, avgPayloadKeys: null, maxPayloadKeys: null, avgPendingPatchKeys: null, maxPendingPatchKeys: null, avgBytes: null, maxBytes: null }
  const summary = (scenario: string): BenchUpdateSummary => {
    const context = { ...heapContext, scenario, route: scenario.endsWith('.patch') ? '/pages/update-patch/index' : heapContext.route }
    const snapshot = (phase: 'before' | 'after') => {
      const native = testNativeEvidence(identity, { ...context, phase }, ++sequence)
      return { provider: 'devtools', toolVersion: identity.toolVersion, sdkVersion: identity.sdkVersion, native, usage: { status: 'available' as const, source: 'appservice-cdp-runtime' as const, usedSize: 12, totalSize: 24 } }
    }
    return {
      wallMsMedian: null,
      metricMsMedian: null,
      computeMsMedian: null,
      commitMsMedian: null,
      dispatchMsMedian: null,
      flushMsMedian: null,
      setDataCallsMedian: null,
      setDataDiagnosticsMedian: diagnostics,
      fallbackReasons: {},
      samples: [{ wallMs: null, metricMs: null, computeMs: null, commitMs: null, dispatchMs: null, flushMs: null, setDataCalls: null, setDataDiagnostics: diagnostics, memory: { workerRssBefore: 0, workerRssAfter: 0, hostHeapBytes: 12, hostHeapCapability: 'available', hostHeapBefore: snapshot('before'), hostHeapAfter: snapshot('after') } }],
    }
  }
  const navigation = { wallMsMedian: null, readyMsMedian: null, firstCommitMsMedian: null }
  return {
    schemaVersion: 2,
    project: 'runtime-bench-vue',
    preset: 'normal',
    firstScreen: navigation,
    detailNavigation: navigation,
    updateSingleCommit: { diff: summary('updateSingleCommit.diff'), patch: summary('updateSingleCommit.patch') },
    updateMicroCommit: { diff: summary('updateMicroCommit.diff'), patch: summary('updateMicroCommit.patch') },
    workloads: Object.fromEntries(['small-field', 'batch', 'append', 'reorder'].map(name => [name, summary(`workloads.${name}`)])),
  }
}

describe('read-back native Inspector memory acceptance', () => {
  it('accepts all original groups only with independent matching before/after native evidence', () => {
    expect(assessBenchMemory(resultFixture())).toEqual({ complete: true, samples: 8, missing: [] })
  })

  it.each(['preset', 'scenario', 'phase'] as const)('rejects a heap checkpoint from another %s', (field) => {
    const result = resultFixture()
    const before = result.updateSingleCommit.diff.samples![0]!.memory!.hostHeapBefore.native!
    before.context = { ...before.context, [field]: field === 'phase' ? 'after' : 'another-checkpoint' }
    const assessment = assessBenchMemory(result)
    expect(assessment.complete).toBe(false)
    expect(assessment.missing).toEqual(expect.arrayContaining([expect.objectContaining({ reason: expect.stringContaining('mismatch') })]))
  })

  it('rejects reused native requests, changed byte mappings, and mixed collection transports', () => {
    const result = resultFixture()
    const first = result.updateSingleCommit.diff.samples![0]!.memory!
    const next = result.updateMicroCommit.diff.samples![0]!.memory!
    next.hostHeapBefore.native = { ...first.hostHeapBefore.native!, context: { ...next.hostHeapBefore.native!.context } }
    expect(assessBenchMemory(result).complete).toBe(false)
    const altered = resultFixture()
    altered.updateSingleCommit.diff.samples![0]!.memory!.hostHeapBefore.usage = { status: 'available', source: 'appservice-cdp-runtime', usedSize: 13, totalSize: 24 }
    expect(assessBenchMemory(altered).missing).toEqual(expect.arrayContaining([expect.objectContaining({ reason: expect.stringContaining('compatibility bytes differ') })]))
    const mixed = resultFixture()
    delete mixed.updateSingleCommit.diff.samples![0]!.memory!.hostHeapBefore.native
    expect(assessBenchMemory(mixed).missing).toEqual(expect.arrayContaining([expect.objectContaining({ reason: 'native-heap-before-after-session-or-order-mismatch' })]))
  })
})
