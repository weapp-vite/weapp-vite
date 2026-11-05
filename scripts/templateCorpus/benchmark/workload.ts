import type { PhysicalMeasurement, ProfileCheckpoint, ProfileFixture, ProfileGroup, ProfileOptions, ProfileSummary, WorkloadJob, WorkloadPlan } from './types'
import { CALIBRATION_POLICY } from '../../benchmarkWxmlParser/calibration'
import { workloadHash, workloadJson } from './workloadHash'

export function workloadThreshold(group: string, operation: string, options: ProfileOptions): number | null {
  return !options.gate || operation === 'preserve-noop' ? null : group.endsWith(options.gate.aggregateGroupSuffix) || options.gate.aggregateGroups?.includes(group) ? options.gate.aggregateMaximumRatio : options.gate.categoryMaximumRatio
}

/** 分类仅在同轮、同实现、同运行时和完整有序输入完全相同时引用同一物理测量。 */
export function createWorkloadPlan(fixtures: readonly ProfileFixture[], groups: readonly ProfileGroup[], options: ProfileOptions): WorkloadPlan | undefined {
  if (!options.workload) {
    return undefined
  }
  if (options.workload.protocol !== 'exact-workload-v2' || !/^[a-f\d]{64}$/.test(options.workload.identitySha256) || !['node', 'chromium'].includes(options.workload.runtime)) {
    throw new TypeError('Unknown or incomplete exact workload scope')
  }
  if (!options.gate) {
    throw new TypeError('Exact workload measurements require a frozen gate policy')
  }
  const byId = new Map(fixtures.map(fixture => [fixture.id, fixture]))
  if (byId.size !== fixtures.length || new Set(groups.map(group => group.id)).size !== groups.length) {
    throw new TypeError('Duplicate fixture or group in workload plan')
  }
  const identities = new Map(fixtures.map(fixture => [fixture.id, workloadHash(workloadJson({ id: fixture.id, sourceSha256: workloadHash(fixture.source), sourceUtf16Sha256: workloadHash(JSON.stringify(fixture.source)), sourceUtf16: fixture.source.length, bytes: fixture.bytes, declaredSha256: fixture.sha256, options: fixture.options, profile: fixture.profile }))]))
  const jobs: WorkloadJob[] = []
  const byKey = new Map<string, WorkloadJob>()
  const cells: WorkloadPlan['cells'] = []
  const operations = options.operations ?? ['scan', 'parse', 'canonical'] as const
  if (new Set(operations).size !== operations.length) {
    throw new TypeError('Duplicate operation in workload plan')
  }
  for (const group of groups) {
    if (options.groups && !options.groups.includes(group.id)) {
      continue
    }
    if (!group.fixtureIds.length || new Set(group.fixtureIds).size !== group.fixtureIds.length || group.fixtureIds.some(id => !byId.has(id))) {
      throw new TypeError('Empty, duplicate or missing fixture in workload group')
    }
    for (const operation of operations) {
      if (group.operations && !group.operations.includes(operation)) {
        continue
      }
      const threshold = group.comparable ? workloadThreshold(group.id, operation, options) : null
      const keySha256 = workloadHash(workloadJson({ scope: options.workload, operation, comparable: group.comparable, informational: operation === 'preserve-noop', threshold, fixtures: group.fixtureIds.map(id => identities.get(id)), rounds: options.rounds, warmup: options.warmup, calibration: CALIBRATION_POLICY }))
      let job = byKey.get(keySha256)
      if (!job) {
        job = { id: `job-${jobs.length + 1}`, keySha256, operation, comparable: group.comparable, threshold, fixtureIds: [...group.fixtureIds], groups: [] }
        jobs.push(job)
        byKey.set(keySha256, job)
      }
      job.groups.push(group.id)
      cells.push({ operation, group: group.id, jobId: job.id })
    }
  }
  const plan = { scope: options.workload, logicalCells: cells.length, physicalJobs: jobs.length, jobs, cells }
  return { ...plan, sha256: workloadHash(workloadJson(plan)) }
}

export function physicalEvidence(record: Extract<ProfileCheckpoint, { kind: 'job' }>): string {
  const { measurement: _measurement, ...summary } = record.summary
  return workloadHash(JSON.stringify({ jobId: record.jobId, keySha256: record.keySha256, operation: record.operation, representativeGroup: record.representativeGroup, samples: record.samples, warmupSamples: record.warmupSamples, calibrations: record.calibrations, parity: record.parity, errors: record.errors, summary }))
}

export function physicalIdentity(record: Extract<ProfileCheckpoint, { kind: 'job' }>): PhysicalMeasurement {
  return { jobId: record.jobId, keySha256: record.keySha256, evidenceSha256: record.evidenceSha256, operation: record.operation, representativeGroup: record.representativeGroup }
}

export function referenceSummary(summary: ProfileSummary, group: string): ProfileSummary {
  return { ...summary, group }
}
