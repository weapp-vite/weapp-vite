import type { ProfileCheckpoint, ProfileFixture, ProfileGroup, ProfileOptions } from './types'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProfileCheckpoint, verifyProfileCheckpoint } from './checkpoint'
import { CheckpointWorkloadState } from './checkpointWorkload'
import { measureProfileWithCheckpoint } from './measure'
import { regressionIntegrity } from './regressionIntegrity'
import { createWorkloadPlan } from './workload'

const calls = vi.hoisted(() => vi.fn())
vi.mock('./operations', () => ({ createProfileRuntime: () => ({ select: () => calls, prepare: () => [], verifyOperation: () => {}, candidateTrees: new Map() }) }))

const fixture: ProfileFixture = { id: 'fixture', source: '<view/>', sha256: 'declared', bytes: 7, options: { syntax: 'xml' }, profile: { id: 'weapp-xml', platform: 'weapp', syntax: 'xml', rawTags: ['wxs'], resolver: 'none' }, frameworks: [], categories: [], quotaEligible: true, features: [], size: 'small', comparison: { eligible: true } }
const groups: ProfileGroup[] = ['first', 'alias', 'aggregate/all'].map(id => ({ id, fixtureIds: [fixture.id], comparable: true, operations: ['parse'] }))
const options: ProfileOptions = { rounds: 2, warmup: 1, operations: ['parse'], gate: { aggregateGroupSuffix: '/all', aggregateMaximumRatio: 1.03, categoryMaximumRatio: 1.05 }, workload: { protocol: 'exact-workload-v2', runtime: 'node', identitySha256: 'a'.repeat(64) } }
const directories: string[] = []
beforeEach(() => {
  let time = 0
  vi.spyOn(performance, 'now').mockImplementation(() => ++time)
})
afterEach(async () => {
  vi.restoreAllMocks()
  calls.mockClear()
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

async function measurement() {
  const records: ProfileCheckpoint[] = []
  const result = await measureProfileWithCheckpoint({} as never, [fixture], groups, options, async (record) => {
    records.push(record)
  })
  return { result, records }
}

describe('physical workload protocol v2', () => {
  it('executes identical work once and preserves every logical conclusion without copying raw samples', async () => {
    const { result, records } = await measurement()
    expect(result.schemaVersion).toBe(2)
    expect(result.workload).toMatchObject({ logicalCells: 3, physicalJobs: 2 })
    expect(result.summaries).toHaveLength(3)
    expect(result.physicalMeasurements).toHaveLength(2)
    expect(result.samples).toHaveLength(8)
    expect(result.warmupSamples).toHaveLength(4)
    expect(result.calibrations).toHaveLength(2)
    expect(result.samples.some(row => row.cohort === 'alias')).toBe(false)
    expect(result.summaries[1]!.measurement).toEqual(result.summaries[0]!.measurement)
    expect(records.map(record => record.kind)).toEqual(['start', 'job', 'reference', 'job', 'complete'])
    expect(records[2]).not.toHaveProperty('samples')
    const measuredCalls = [...result.samples, ...result.warmupSamples ?? []].reduce((sum, sample) => sum + sample.iterations, 0)
    const calibrationCalls = result.calibrations.flatMap(calibration => calibration.probes).reduce((sum, probe) => sum + probe.iterations, 0)
    expect(calls).toHaveBeenCalledTimes(measuredCalls + calibrationCalls + 2)
    expect(regressionIntegrity(result, [fixture], groups, options)).toEqual([])
  })

  it('keeps legacy independent profiles on v1 and refuses to reinterpret them as shared evidence', async () => {
    const result = await measureProfileWithCheckpoint({} as never, [fixture], groups, { ...options, workload: undefined }, async () => {})
    expect(result.schemaVersion).toBe(1)
    expect(result.samples).toHaveLength(12)
    expect(result.workload).toBeUndefined()
    expect(regressionIntegrity(result, [fixture], groups, options)).not.toEqual([])
    const shared = (await measurement()).result
    expect(regressionIntegrity(shared, [fixture], groups, { ...options, workload: undefined })).toContain('Legacy measurement cannot claim shared workload evidence')
  })

  it('durably verifies physical evidence and logical references while retaining legacy checkpoint rejection', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'physical-workload-'))
    directories.push(directory)
    const { result, records } = await measurement()
    const writer = await createProfileCheckpoint(directory, 'node', groups, options, [fixture])
    try {
      for (const record of records) {
        await writer.append(record)
      }
      await writer.complete(result)
      expect(writer.reference).toMatchObject({ completedCells: 3, totalCells: 3, completedJobs: 2, totalJobs: 2, protocol: 'exact-workload-v2', status: 'complete' })
      const rows = (await readFile(path.join(directory, 'node-cells.ndjson'), 'utf8')).trim().split('\n').map(line => JSON.parse(line) as { payload: ProfileCheckpoint })
      expect(rows.filter(row => Object.hasOwn(row.payload, 'samples'))).toHaveLength(3)
      const logical = groups.map(group => ({ operation: 'parse', group: group.id }))
      await expect(verifyProfileCheckpoint(path.join(directory, 'node-cells.ndjson'), result, logical, createWorkloadPlan([fixture], groups, options))).resolves.toMatchObject({ completedCells: 3 })
      await expect(verifyProfileCheckpoint(path.join(directory, 'node-cells.ndjson'), { ...result, schemaVersion: 1, workload: undefined }, logical)).rejects.toThrow('protocol version differs')
    }
    finally {
      await writer.close('failed')
    }
  })

  it('rejects changed raw data, false scope, duplicated alias samples and altered reference conclusions', async () => {
    const { result } = await measurement()
    for (const change of [
      () => {
        const changed = structuredClone(result)
        changed.samples[0]!.durationMs++
        return changed
      },
      () => {
        const changed = structuredClone(result)
        changed.samples.push({ ...changed.samples[0]!, cohort: 'alias' })
        return changed
      },
      () => {
        const changed = structuredClone(result)
        changed.summaries[1]!.status = 'regression'
        return changed
      },
      () => {
        const changed = structuredClone(result)
        changed.summaries[1]!.measurement!.evidenceSha256 = 'b'.repeat(64)
        return changed
      },
      () => {
        const changed = structuredClone(result)
        changed.physicalMeasurements!.reverse()
        return changed
      },
    ]) {
      expect(regressionIntegrity(change(), [fixture], groups, options).length).toBeGreaterThan(0)
    }
    expect(regressionIntegrity(result, [fixture], groups, { ...options, workload: { ...options.workload!, runtime: 'chromium' } }).length).toBeGreaterThan(0)
    expect(regressionIntegrity(result, [{ ...fixture, source: '<other/>' }], groups, options).length).toBeGreaterThan(0)
  })

  it('rejects orphan references, duplicate jobs, mixed protocols and raw arrays hidden in an alias', async () => {
    const { records } = await measurement()
    const plan = createWorkloadPlan([fixture], groups, options)!
    const start = records[0] as Extract<ProfileCheckpoint, { kind: 'start' }>
    const job = records[1] as Extract<ProfileCheckpoint, { kind: 'job' }>
    const reference = records[2] as Extract<ProfileCheckpoint, { kind: 'reference' }>
    expect(() => new CheckpointWorkloadState().start(start)).toThrow('protocol version differs')
    const orphan = new CheckpointWorkloadState(plan)
    expect(() => orphan.cell({ ...reference, group: 'first' })).toThrow('Orphan')
    const repeated = new CheckpointWorkloadState(plan)
    repeated.cell(job)
    expect(() => repeated.cell({ ...job, group: 'alias' })).toThrow('Duplicate')
    const mixed = new CheckpointWorkloadState(plan)
    expect(() => mixed.cell({ ...job, kind: 'cell' })).toThrow('legacy raw cells')
    const hidden = new CheckpointWorkloadState(plan)
    hidden.cell(job)
    expect(() => hidden.cell({ ...reference, samples: [] } as typeof reference)).toThrow('duplicate raw evidence')
  })
})
