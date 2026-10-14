import type { WorkerResult } from './types'
import assert from 'node:assert/strict'
import { validateNativeInspectorHeapEvidence } from './nativeInspectorHeap/protocol'

export function assertEquivalentBenchConsumers(normal: {
  sourceHash: string
  archiveHash: string
  installedClosure: Array<{ location: string, version: string | null, integrity: string | null }>
}, performance: typeof normal) {
  assert.equal(normal.sourceHash, performance.sourceHash, 'Preset fixture inputs differ')
  assert.equal(normal.archiveHash, performance.archiveHash, 'Preset candidate archives differ')
  const sorted = (value: typeof normal) => [...value.installedClosure].sort((a, b) => a.location.localeCompare(b.location))
  assert.deepEqual(sorted(normal), sorted(performance), 'Preset installed dependency closures differ')
}

/** 内存验收独立于采样完成；unsupported 的宿主原因原样保留。 */
export function assessBenchMemory(result?: WorkerResult) {
  const missing: Array<{ scenario: string, index?: number, phase?: string, reason: string }> = []
  let samples = 0
  const nativeSequences = new Set<string>()
  const nativeRequests = new Set<string>()
  const groups = {
    'updateSingleCommit.diff': result?.updateSingleCommit.diff,
    'updateMicroCommit.diff': result?.updateMicroCommit.diff,
    'updateSingleCommit.patch': result?.updateSingleCommit.patch,
    'updateMicroCommit.patch': result?.updateMicroCommit.patch,
    ...Object.fromEntries(['small-field', 'batch', 'append', 'reorder'].map(name => [`workloads.${name}`, result?.workloads?.[name]])),
  }
  for (const [scenario, group] of Object.entries(groups)) {
    if (!group?.samples?.length) {
      missing.push({ scenario, reason: 'missing-samples' })
      continue
    }
    for (const [index, sample] of group.samples.entries()) {
      samples++
      for (const phase of ['hostHeapBefore', 'hostHeapAfter'] as const) {
        const snapshot = sample.memory?.[phase]
        let reason = !snapshot
          ? 'missing-host-heap'
          : snapshot.usage.status !== 'available'
            ? snapshot.usage.reason
            : snapshot.provider !== 'devtools'
              ? 'not-devtools'
              : !snapshot.toolVersion || !snapshot.sdkVersion
                  ? 'missing-host-version'
                  : undefined
        if (!reason && snapshot?.native) {
          try {
            validateNativeInspectorHeapEvidence(snapshot.native)
            const native = snapshot.native
            const sequence = `${native.sessionId}:${native.sequence}`
            const request = `${native.sessionId}:${native.raw.requestId}`
            assert.equal(native.context.preset, result?.preset, 'Native heap preset mismatch')
            assert.equal(native.context.scenario, scenario, 'Native heap scenario mismatch')
            assert.equal(native.context.sampleIndex, index, 'Native heap sample mismatch')
            assert.equal(native.context.phase, phase === 'hostHeapBefore' ? 'before' : 'after', 'Native heap phase mismatch')
            assert.equal(native.context.route, scenario.endsWith('.patch') ? '/pages/update-patch/index' : '/pages/update/index', 'Native heap route mismatch')
            assert(snapshot.usage.status === 'available' && snapshot.usage.usedSize === native.raw.response.usedSize
              && snapshot.usage.totalSize === native.raw.response.totalSize, 'Native heap compatibility bytes differ')
            assert(!nativeSequences.has(sequence) && !nativeRequests.has(request), 'Repeated native heap evidence')
            nativeSequences.add(sequence)
            nativeRequests.add(request)
          }
          catch (error) {
            reason = `invalid-native-heap: ${error instanceof Error ? error.message : String(error)}`
          }
        }
        if (reason) {
          missing.push({ scenario, index, phase, reason })
        }
      }
      const before = sample.memory?.hostHeapBefore?.native
      const after = sample.memory?.hostHeapAfter?.native
      if (before || after) {
        if (!before || !after || before.sessionId !== after.sessionId || before.raw?.targetUrl !== after.raw?.targetUrl
          || before.raw?.isolate?.id !== after.raw?.isolate?.id || before.sequence >= after.sequence || before.raw?.afterIsolateRequestId >= after.raw?.isolateRequestId) {
          missing.push({ scenario, index, reason: 'native-heap-before-after-session-or-order-mismatch' })
        }
      }
    }
  }
  return { complete: missing.length === 0, samples, missing }
}
