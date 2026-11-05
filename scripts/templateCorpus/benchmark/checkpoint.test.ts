import type { ProfileCheckpoint, ProfileGroup, ProfileMeasurement } from './types'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { statistics } from '../../benchmarkWxmlParser/statistics'
import { createProfileCheckpoint, verifyProfileCheckpoint } from './checkpoint'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})
const groups: ProfileGroup[] = ['first', 'second'].map(id => ({ id, comparable: true, fixtureIds: ['fixture'], operations: ['parse'] }))
const plan = groups.map(group => ({ operation: 'parse', group: group.id }))
const options = { rounds: 1, warmup: 0, operations: ['parse'] as const }

function evidence() {
  const result: ProfileMeasurement = { schemaVersion: 1, purpose: 'independent-corpus-profile', oldPerformanceGate: 'unchanged-464-document-bench:check', rounds: 1, warmup: 0, clock: { source: 'performance.now', reads: 1, positiveChanges: 1, minimumPositiveDeltaMs: 0.001, maximumPositiveDeltaMs: 0.001, timeOrigin: 1, crossOriginIsolated: null, secureContext: null }, samples: [], warmupSamples: [], calibrations: [], parity: [], summaries: [], errors: [], firstCalls: [] }
  const records: ProfileCheckpoint[] = [{ kind: 'start', schemaVersion: 1, rounds: 1, warmup: 0, clock: result.clock, errors: [], firstCalls: [] }]
  groups.forEach((group, index) => {
    const samples: ProfileMeasurement['samples'] = (['baseline', 'candidate'] as const).map(arm => ({ operation: 'parse', cohort: group.id, round: 0, arm, phase: 'primary', durationMs: 10, iterations: 1, documents: 1, bytes: 8 }))
    const baseline = statistics(samples.filter(row => row.arm === 'baseline'))
    const candidate = statistics(samples.filter(row => row.arm === 'candidate'))
    const summary: ProfileMeasurement['summaries'][number] = { operation: 'parse', group: group.id, comparable: true, status: 'complete', baseline, candidate, ratio: 1 }
    result.samples.push(...samples)
    result.summaries.push(summary)
    records.push({ kind: 'cell', operation: 'parse', group: group.id, completed: index + 1, total: groups.length, samples, warmupSamples: [], calibrations: [], parity: [], errors: [], summary })
  })
  records.push({ kind: 'complete', cells: groups.length, samples: result.samples.length, warmupSamples: 0, parity: 0, errors: 0 })
  return { result, records }
}

async function writer() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'profile-checkpoint-'))
  directories.push(directory)
  return { directory, file: path.join(directory, 'node-cells.ndjson'), state: path.join(directory, 'node-checkpoint.json'), writer: await createProfileCheckpoint(directory, 'node', groups, options) }
}

describe('durable per-cell benchmark evidence', () => {
  it('persists only incremental cells and verifies them against the complete raw result', async () => {
    const fixture = await writer()
    const { result, records } = evidence()
    try {
      await fixture.writer.append(records[0]!)
      await fixture.writer.append(records[1]!)
      const partial = await readFile(fixture.file, 'utf8')
      expect(partial.trim().split('\n')).toHaveLength(2)
      expect(partial).not.toContain('"group":"second"')
      expect(JSON.parse(await readFile(fixture.state, 'utf8'))).toEqual(expect.objectContaining({ status: 'running', completedCells: 1, totalCells: 2 }))
      await fixture.writer.append(records[2]!)
      await fixture.writer.append(records[3]!)
      await fixture.writer.complete(result)
      await fixture.writer.assertUnchanged()
      expect(fixture.writer.reference).toEqual(expect.objectContaining({ status: 'complete', records: 4, completedCells: 2, sha256: expect.stringMatching(/^[a-f\d]{64}$/) }))
      expect(await verifyProfileCheckpoint(fixture.file, result, plan)).toEqual(expect.objectContaining({ records: 4, completedCells: 2 }))
      await writeFile(fixture.file, `${await readFile(fixture.file, 'utf8')}\n`)
      await expect(fixture.writer.assertUnchanged()).rejects.toThrow('checkpoint file changed')
    }
    finally {
      await fixture.writer.close('failed')
    }
  })

  it('retains an interrupted prefix and cannot accept it as a complete run', async () => {
    const fixture = await writer()
    const { result, records } = evidence()
    await fixture.writer.append(records[0]!)
    await fixture.writer.append(records[1]!)
    await fixture.writer.close('interrupted', 'SIGINT')
    await fixture.writer.close('failed')
    expect(JSON.parse(await readFile(fixture.state, 'utf8'))).toEqual(expect.objectContaining({ status: 'interrupted', reason: 'SIGINT', completedCells: 1, records: 2 }))
    await expect(verifyProfileCheckpoint(fixture.file, result, plan)).rejects.toThrow('incomplete')
    await expect(fixture.writer.append(records[2]!)).rejects.toThrow('already closed')
  })

  it('rejects changed raw evidence and a final report that differs from persisted samples', async () => {
    const fixture = await writer()
    const { result, records } = evidence()
    try {
      for (const record of records) {
        await fixture.writer.append(record)
      }
      const changed = structuredClone(result)
      changed.samples[0]!.durationMs++
      await expect(fixture.writer.complete(changed)).rejects.toThrow('samples differ')
      const lines = (await readFile(fixture.file, 'utf8')).trim().split('\n')
      const record = JSON.parse(lines[1]!) as { payload: Extract<ProfileCheckpoint, { kind: 'cell' }> }
      record.payload.samples[0]!.durationMs++
      lines[1] = JSON.stringify(record)
      await writeFile(fixture.file, `${lines.join('\n')}\n`)
      await expect(verifyProfileCheckpoint(fixture.file, result, plan)).rejects.toThrow('payload changed')
    }
    finally {
      await fixture.writer.close('failed')
    }
  })

  it('rejects replacement ordering and premature completion before appending bytes', async () => {
    const fixture = await writer()
    const { records } = evidence()
    try {
      await fixture.writer.append(records[0]!)
      await expect(fixture.writer.append(records[2]!)).rejects.toThrow('frozen workload')
      await expect(fixture.writer.append(records[3]!)).rejects.toThrow('premature')
      expect((await readFile(fixture.file, 'utf8')).trim().split('\n')).toHaveLength(1)
    }
    finally {
      await fixture.writer.close('failed')
    }
  })
})
