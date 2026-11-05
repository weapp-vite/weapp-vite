import type { ProfileCheckpoint, ProfileSummary, WorkloadPlan } from './types'
import assert from 'node:assert/strict'
import { physicalEvidence, referenceSummary } from './workload'

const same = (actual: unknown, expected: unknown) => assert.equal(JSON.stringify(actual), JSON.stringify(expected), 'Checkpoint workload evidence differs')

/** v1 每格必须有原始样本；v2 仅允许首个任务保存样本，后续分类必须引用已有证据。 */
export class CheckpointWorkloadState {
  private readonly jobs = new Map<string, ProfileSummary>()
  private completed = 0

  constructor(readonly plan?: WorkloadPlan) {}

  get physicalJobs() { return this.jobs.size }

  start(record: Extract<ProfileCheckpoint, { kind: 'start' }>) {
    assert.equal(record.schemaVersion, this.plan ? 2 : 1, 'Checkpoint protocol version differs')
    same(record.workload, this.plan)
  }

  cell(record: Exclude<ProfileCheckpoint, { kind: 'start' | 'complete' }>) {
    if (!this.plan) {
      assert.equal(record.kind, 'cell', 'Legacy checkpoint cannot contain shared workload records')
      return
    }
    assert.ok(record.kind === 'job' || record.kind === 'reference', 'Workload v2 cannot contain legacy raw cells')
    const cell = this.plan.cells[this.completed]
    assert.ok(cell && cell.operation === record.operation && cell.group === record.group && cell.jobId === record.jobId, 'Checkpoint logical reference differs from external workload')
    const job = this.plan.jobs.find(job => job.id === cell.jobId)!
    if (record.kind === 'job') {
      assert.ok(!this.jobs.has(job.id) && job.groups[0] === record.group, 'Duplicate or misplaced physical measurement')
      assert.equal(record.keySha256, job.keySha256, 'Checkpoint job key changed')
      assert.equal(record.representativeGroup, job.groups[0], 'Checkpoint representative changed')
      assert.ok(record.summary.operation === record.operation && record.summary.group === record.group, 'Checkpoint physical summary changed its classification')
      assert.equal(record.evidenceSha256, physicalEvidence(record), 'Checkpoint physical raw evidence changed')
      same(record.summary.measurement, { jobId: job.id, evidenceSha256: record.evidenceSha256, representativeGroup: record.group })
      this.jobs.set(job.id, record.summary)
    }
    else {
      assert.ok(!['samples', 'warmupSamples', 'calibrations', 'parity', 'errors'].some(key => Object.hasOwn(record, key)), 'Logical references cannot contain duplicate raw evidence')
      const previous = this.jobs.get(job.id)
      assert.ok(previous, 'Orphan checkpoint measurement reference')
      assert.equal(record.evidenceSha256, previous.measurement!.evidenceSha256, 'Checkpoint referenced evidence changed')
      same(record.summary, referenceSummary(previous, record.group))
    }
    this.completed++
  }

  complete(record: Extract<ProfileCheckpoint, { kind: 'complete' }>) {
    if (this.plan) {
      assert.ok(record.physicalJobs === this.plan.physicalJobs && this.jobs.size === this.plan.physicalJobs && this.completed === this.plan.logicalCells, 'Checkpoint physical workload is incomplete')
    }
    else { assert.equal(record.physicalJobs, undefined, 'Legacy checkpoint cannot claim workload reuse') }
  }
}
