import type { FileHandle } from 'node:fs/promises'
import type { ProfileCheckpoint, ProfileFixture, ProfileGroup, ProfileMeasurement, ProfileOptions, WorkloadPlan } from './types'
import assert from 'node:assert/strict'
import { createReadStream } from 'node:fs'
import { open, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { corpusHash } from '../integrity'
import { repositoryRoot } from '../paths'
import { CheckpointWorkloadState } from './checkpointWorkload'
import { createWorkloadPlan, physicalIdentity } from './workload'

interface CheckpointEnvelope {
  schemaVersion: 1
  sequence: number
  previousSha256: string | null
  payloadSha256: string
  sha256: string
  payload: ProfileCheckpoint
}

export interface CheckpointReference {
  runtime: string
  file: string
  stateFile: string
  status: 'running' | 'complete' | 'interrupted' | 'failed'
  completedCells: number
  totalCells: number
  records: number
  bytes: number
  lastSha256: string | null
  sha256?: string
  reason?: string
  protocol?: 'exact-workload-v2'
  completedJobs?: number
  totalJobs?: number
}

const label = (file: string) => path.relative(repositoryRoot, file).replaceAll('\\', '/')
const digest = (value: unknown) => corpusHash(JSON.stringify(value) ?? '<undefined>')
const categories = ['samples', 'warmupSamples', 'calibrations', 'parity', 'errors', 'summaries', 'firstCalls', 'physicalMeasurements'] as const

/** 逐行验证哈希链并重建原始证据；最终结果必须与所有已落盘行逐项相同。 */
export async function verifyProfileCheckpoint(file: string, result: ProfileMeasurement, plan: readonly { operation: string, group: string }[], workload?: WorkloadPlan) {
  assert.equal(result.schemaVersion, workload ? 2 : 1, 'Final checkpoint protocol differs')
  assert.equal(digest(result.workload), digest(workload), 'Final workload plan differs')
  const state = new CheckpointWorkloadState(workload)
  const recorded: Record<typeof categories[number], unknown[]> = { samples: [], warmupSamples: [], calibrations: [], parity: [], errors: [], summaries: [], firstCalls: [], physicalMeasurements: [] }
  let previous: string | null = null
  let sequence = 0
  let completed = 0
  let started = false
  let finished = false
  const lines = createInterface({ input: createReadStream(file), crlfDelay: Infinity })
  for await (const line of lines) {
    const record = JSON.parse(line) as CheckpointEnvelope
    assert.equal(record.schemaVersion, 1, 'Checkpoint envelope version differs')
    assert.equal(record.sequence, sequence++, 'Checkpoint sequence differs')
    assert.equal(record.previousSha256, previous, 'Checkpoint hash chain differs')
    assert.equal(record.payloadSha256, digest(record.payload), 'Checkpoint payload changed')
    assert.equal(record.sha256, digest({ sequence: record.sequence, previousSha256: previous, payloadSha256: record.payloadSha256 }), 'Checkpoint envelope changed')
    assert.ok(!finished, 'Checkpoint has rows after completion')
    previous = record.sha256
    const payload = record.payload
    if (payload.kind === 'start') {
      assert.ok(!started && record.sequence === 0, 'Checkpoint start is duplicated or misplaced')
      started = true
      state.start(payload)
      assert.equal(payload.rounds, result.rounds, 'Checkpoint rounds differ')
      assert.equal(payload.warmup, result.warmup, 'Checkpoint warmup differs')
      assert.equal(digest(payload.clock), digest(result.clock), 'Checkpoint clock differs')
      recorded.firstCalls.push(...payload.firstCalls)
      recorded.errors.push(...payload.errors)
    }
    else if (payload.kind === 'cell' || payload.kind === 'job' || payload.kind === 'reference') {
      const expected = plan[completed++]
      assert.ok(started && expected && expected.operation === payload.operation && expected.group === payload.group && payload.completed === completed && payload.total === plan.length, 'Checkpoint cell differs from frozen workload')
      state.cell(payload)
      if (payload.kind !== 'reference') {
        for (const key of ['samples', 'warmupSamples', 'calibrations', 'parity', 'errors'] as const) {
          recorded[key].push(...payload[key])
        }
      }
      if (payload.kind === 'job') {
        recorded.physicalMeasurements.push(physicalIdentity(payload))
      }
      recorded.summaries.push(payload.summary)
    }
    else if (payload.kind === 'complete') {
      assert.ok(started && completed === plan.length && payload.cells === completed, 'Checkpoint completed without the full workload')
      state.complete(payload)
      for (const key of ['samples', 'warmupSamples', 'parity', 'errors'] as const) {
        assert.equal(payload[key], recorded[key].length, `Checkpoint ${key} count differs`)
      }
      finished = true
    }
    else {
      assert.fail('Unknown checkpoint payload')
    }
  }
  assert.ok(started && finished, 'Checkpoint is incomplete')
  for (const key of categories) {
    assert.equal(digest(recorded[key]), digest(result[key] ?? []), `Checkpoint ${key} differ from final raw result`)
  }
  return { records: sequence, completedCells: completed, lastSha256: previous, sha256: corpusHash(await readFile(file)) }
}

/** 只追加本格增量并同步到磁盘；小状态文件不包含历史 samples，不会逐格重写全量结果。 */
export class ProfileCheckpointWriter {
  readonly reference: CheckpointReference
  private closed = false
  private started = false
  private finished = false
  private readonly workloadState: CheckpointWorkloadState

  constructor(private readonly handle: FileHandle, private readonly file: string, private readonly stateFile: string, private readonly plan: readonly { operation: string, group: string }[], runtime: string, private readonly workload?: WorkloadPlan) {
    this.workloadState = new CheckpointWorkloadState(workload)
    this.reference = { runtime, file: label(file), stateFile: label(stateFile), status: 'running', completedCells: 0, totalCells: plan.length, records: 0, bytes: 0, lastSha256: null, ...(workload ? { protocol: workload.scope.protocol, completedJobs: 0, totalJobs: workload.physicalJobs } : {}) }
  }

  private async state() {
    const temporary = `${this.stateFile}.next`
    await writeFile(temporary, `${JSON.stringify(this.reference, null, 2)}\n`)
    await rename(temporary, this.stateFile)
  }

  async append(payload: ProfileCheckpoint): Promise<void> {
    assert.ok(!this.closed && !this.finished, 'Checkpoint is already closed')
    if (payload.kind === 'start') {
      assert.ok(!this.started && this.reference.records === 0, 'Checkpoint start is duplicated')
      this.workloadState.start(payload)
      this.started = true
    }
    else if (payload.kind === 'cell' || payload.kind === 'job' || payload.kind === 'reference') {
      const expected = this.plan[this.reference.completedCells]
      assert.ok(this.started && expected && expected.operation === payload.operation && expected.group === payload.group && payload.completed === this.reference.completedCells + 1 && payload.total === this.plan.length, 'Checkpoint cell differs from frozen workload')
      this.workloadState.cell(payload)
    }
    else {
      assert.ok(this.started && payload.cells === this.plan.length && this.reference.completedCells === this.plan.length, 'Checkpoint completion is premature')
      this.workloadState.complete(payload)
    }
    const header = { sequence: this.reference.records, previousSha256: this.reference.lastSha256, payloadSha256: digest(payload) }
    const record: CheckpointEnvelope = { schemaVersion: 1, ...header, sha256: digest(header), payload }
    const line = `${JSON.stringify(record)}\n`
    await this.handle.writeFile(line)
    await this.handle.sync()
    this.reference.records++
    this.reference.bytes += new TextEncoder().encode(line).length
    this.reference.lastSha256 = record.sha256
    if (payload.kind === 'cell' || payload.kind === 'job' || payload.kind === 'reference') {
      this.reference.completedCells = payload.completed
      if (this.workload) {
        this.reference.completedJobs = this.workloadState.physicalJobs
      }
    }
    if (payload.kind === 'complete') {
      this.finished = true
    }
    await this.state()
  }

  async complete(result: ProfileMeasurement): Promise<void> {
    const verified = await verifyProfileCheckpoint(this.file, result, this.plan, this.workload)
    assert.equal(verified.records, this.reference.records, 'Checkpoint record count changed')
    assert.equal(verified.lastSha256, this.reference.lastSha256, 'Checkpoint tail changed')
    this.reference.sha256 = verified.sha256
    await this.close('complete')
  }

  async assertUnchanged(): Promise<void> {
    assert.ok(this.reference.status === 'complete' && this.reference.sha256, 'Checkpoint has not completed')
    assert.equal(corpusHash(await readFile(this.file)), this.reference.sha256, 'Completed checkpoint file changed')
  }

  async close(status: CheckpointReference['status'], reason?: string): Promise<void> {
    if (this.closed) {
      return
    }
    this.closed = true
    this.reference.status = status
    if (reason) {
      this.reference.reason = reason.replaceAll(repositoryRoot, '<repository>')
    }
    try {
      await this.handle.close()
    }
    finally {
      await this.state()
    }
  }
}

export async function createProfileCheckpoint(output: string, runtime: string, groups: readonly ProfileGroup[], options: ProfileOptions, fixtures?: readonly ProfileFixture[]): Promise<ProfileCheckpointWriter> {
  const operations = options.operations ?? ['scan', 'parse', 'canonical']
  const plan = groups.filter(group => !options.groups || options.groups.includes(group.id)).flatMap(group => operations.filter(operation => !group.operations || group.operations.includes(operation)).map(operation => ({ operation, group: group.id })))
  const file = path.join(output, `${runtime}-cells.ndjson`)
  assert.ok(!options.workload || (fixtures && options.workload.runtime === runtime), 'Workload checkpoint requires explicit runtime and frozen fixtures')
  const workload = createWorkloadPlan(fixtures ?? [], groups, options)
  return new ProfileCheckpointWriter(await open(file, 'wx'), file, path.join(output, `${runtime}-checkpoint.json`), plan, runtime, workload)
}
