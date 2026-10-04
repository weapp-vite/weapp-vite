import type { WorkerResult } from './types'
import assert from 'node:assert/strict'

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
        const reason = !snapshot
          ? 'missing-host-heap'
          : snapshot.usage.status !== 'available'
            ? snapshot.usage.reason
            : snapshot.provider !== 'devtools'
              ? 'not-devtools'
              : !snapshot.toolVersion || !snapshot.sdkVersion
                  ? 'missing-host-version'
                  : undefined
        if (reason) {
          missing.push({ scenario, index, phase, reason })
        }
      }
    }
  }
  return { complete: missing.length === 0, samples, missing }
}
