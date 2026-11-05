import type { ProfileCheckpoint, ProfileFixture, ProfileGroup, ProfileMeasurement, ProfileOptions } from './types'
import { createWorkloadPlan, physicalEvidence, referenceSummary } from './workload'

type Validator = (result: ProfileMeasurement, fixtures: readonly ProfileFixture[], groups: readonly ProfileGroup[], options: ProfileOptions) => string[]
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)

/** 从外部冻结输入重建任务，不将报告自带的引用或复用数量当作事实。 */
export function workloadIntegrity(result: ProfileMeasurement, fixtures: readonly ProfileFixture[], groups: readonly ProfileGroup[], options: ProfileOptions, validate: Validator): string[] {
  const errors: string[] = []
  const plan = createWorkloadPlan(fixtures, groups, options)!
  if (result.schemaVersion !== 2 || !same(result.workload, plan)) {
    errors.push('workload protocol, scope or external plan differs')
  }
  if (result.summaries.length !== plan.logicalCells || result.physicalMeasurements?.length !== plan.physicalJobs) {
    errors.push('logical or physical workload is incomplete')
  }
  const physicalKeys = new Set(plan.jobs.map(job => `${job.operation}:${job.groups[0]}`))
  for (const row of [...result.samples, ...(result.warmupSamples ?? []), ...result.calibrations]) {
    if (!physicalKeys.has(`${row.operation}:${row.cohort}`)) {
      errors.push('raw samples/calibration were duplicated into a logical alias or unknown job')
    }
  }
  const parity = new Set<string>()
  const expectedParity = new Set(plan.jobs.flatMap(job => job.fixtureIds.map(id => `${job.operation}:${id}`)))
  for (const row of result.parity ?? []) {
    const key = `${row.operation}:${row.fixture}`
    if (parity.has(key) || !expectedParity.has(key) || !row.equal) {
      errors.push('duplicate, unexpected or failed physical parity')
    }
    parity.add(key)
  }
  if (parity.size !== expectedParity.size) {
    errors.push('physical parity is incomplete')
  }
  const seenParity = new Set<string>()
  const physical = new Map<string, { summary: ProfileMeasurement['summaries'][number], record: Extract<ProfileCheckpoint, { kind: 'job' }> }>()
  for (const [index, job] of plan.jobs.entries()) {
    const group = job.groups[0]!
    const summary = result.summaries.find(summary => summary.operation === job.operation && summary.group === group)
    const identity = result.physicalMeasurements?.[index]
    if (!summary || !identity) {
      errors.push(`missing physical job ${job.id}`)
      continue
    }
    const newlyVerified = new Set(job.fixtureIds.map(id => `${job.operation}:${id}`).filter(key => !seenParity.has(key)))
    for (const key of newlyVerified) {
      seenParity.add(key)
    }
    const record: Extract<ProfileCheckpoint, { kind: 'job' }> = { kind: 'job', ...identity, operation: job.operation, group, completed: 0, total: plan.logicalCells, summary, samples: result.samples.filter(row => row.operation === job.operation && row.cohort === group), warmupSamples: (result.warmupSamples ?? []).filter(row => row.operation === job.operation && row.cohort === group), calibrations: result.calibrations.filter(row => row.operation === job.operation && row.cohort === group), parity: (result.parity ?? []).filter(row => newlyVerified.has(`${row.operation}:${row.fixture}`)), errors: result.errors.filter(row => row.operation === job.operation && row.group === group) }
    const evidenceSha256 = physicalEvidence(record)
    if (!same(identity, { jobId: job.id, keySha256: job.keySha256, evidenceSha256, operation: job.operation, representativeGroup: group })) {
      errors.push(`physical identity or raw evidence changed ${job.id}`)
    }
    if (!same(summary.measurement, { jobId: job.id, evidenceSha256, representativeGroup: group })) {
      errors.push(`physical summary reference changed ${job.id}`)
    }
    physical.set(job.id, { summary, record })
  }
  for (const [index, cell] of plan.cells.entries()) {
    const summary = result.summaries[index]
    const job = physical.get(cell.jobId)
    if (!job || !summary || !same(summary, referenceSummary(job.summary, cell.group))) {
      errors.push(`missing, replaced or reordered logical reference ${cell.operation}:${cell.group}`)
      continue
    }
    const group = groups.find(group => group.id === cell.group)!
    const rows = <T extends { cohort: string }>(values: T[]) => values.map(row => ({ ...row, cohort: cell.group }))
    const projected: ProfileMeasurement = { ...result, schemaVersion: 1, workload: undefined, physicalMeasurements: undefined, samples: rows(job.record.samples), warmupSamples: rows(job.record.warmupSamples), calibrations: rows(job.record.calibrations), summaries: [summary], parity: (result.parity ?? []).filter(row => row.operation === cell.operation && group.fixtureIds.includes(row.fixture)) }
    errors.push(...validate(projected, fixtures, [{ ...group, operations: [cell.operation] }], { ...options, workload: undefined, groups: undefined, operations: [cell.operation] }))
  }
  return errors
}
