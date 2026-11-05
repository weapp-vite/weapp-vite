import type { CheckpointReference } from './checkpoint'
import type { ProfileCheckpoint, ProfileFixture, ProfileGroup, ProfileOperation, ProfileSummary } from './types'
import { describe, expect, it, vi } from 'vitest'
import { statistics } from '../../benchmarkWxmlParser/statistics'
import { regressionCellFailure, regressionCheckpointHandler, RegressionStop, selectRegressionWorkload } from './regressionSelection'

function fixture(id: string, suite: ProfileFixture['suite']): ProfileFixture {
  return { id, sha256: id, source: `<${id}/>`, bytes: 8, profile: { id: 'weapp', platform: 'weapp', syntax: 'legacy', rawTags: ['wxs'], resolver: 'none' }, options: { syntax: 'legacy' }, frameworks: [], categories: [], quotaEligible: true, features: [], size: 'small', comparison: { eligible: true }, suite }
}

const fixtures = [fixture('first', 'old464'), fixture('second', 'all-platform'), fixture('third', 'all-platform')]
const groups: ProfileGroup[] = [
  { id: 'shared', comparable: true, fixtureIds: ['first', 'second'] },
  { id: 'platform', comparable: true, fixtureIds: ['second', 'third'], operations: ['parse'] },
  { id: 'consumer', comparable: true, fixtureIds: ['first'], operations: ['consumer-web'] },
]
const operations: ProfileOperation[] = ['scan', 'parse', 'consumer-web']

function cell(status: ProfileSummary['status']): Extract<ProfileCheckpoint, { kind: 'cell' }> {
  return { kind: 'cell', operation: 'parse', group: 'shared', completed: 1, total: 2, samples: [], warmupSamples: [], calibrations: [], parity: [], errors: [], summary: { operation: 'parse', group: 'shared', status, comparable: true, candidate: statistics([]), ratio: null } }
}

describe('explicit regression diagnostic workload', () => {
  it('limits fixtures to the union of requested operation/group cells while retaining full counts', () => {
    const workload = selectRegressionWorkload(fixtures, groups, operations, { check: false, groups: ['platform'], operations: ['parse'] })
    expect(workload.fixtures.map(input => input.id)).toEqual(['second', 'third'])
    expect(workload.groups.map(group => group.id)).toEqual(['platform'])
    expect(workload.operations).toEqual(['parse'])
    expect(workload.coreProfile).toBe(false)
    expect(workload.report).toMatchObject({ scope: 'filtered-diagnostic', full: { fixtures: 3, groups: 3, cells: 5 }, selected: { fixtures: 2, groups: 1, cells: 1 } })
    expect(fixtures).toHaveLength(3)
    expect(groups).toHaveLength(3)
  })

  it('removes groups without the requested operations before collecting fixtures', () => {
    const workload = selectRegressionWorkload(fixtures, groups, operations, { check: false, operations: ['scan'] })
    expect(workload.groups.map(group => group.id)).toEqual(['shared'])
    expect(workload.fixtures.map(input => input.id)).toEqual(['first', 'second'])
    expect(workload.report.selected.cells).toBe(1)
  })

  it('retains the full formal matrix and default all-platform core research', () => {
    const workload = selectRegressionWorkload(fixtures, groups, operations, { check: true })
    expect(workload.fixtures).toEqual(fixtures)
    expect(workload.groups).toEqual(groups)
    expect(workload.operations).toEqual(operations)
    expect(workload.coreProfile).toBe(true)
    expect(workload.coreFixtures.map(input => input.id)).toEqual(['second', 'third'])
    expect(workload.report).toMatchObject({ scope: 'complete', full: { cells: 5 }, selected: { cells: 5 }, keepGoing: false })
  })

  it('requires explicit filtered core profiling and uses the selected frozen profile configuration', () => {
    const selected = selectRegressionWorkload(fixtures, groups, operations, { check: false, groups: ['consumer'], coreProfile: true })
    expect(selected.coreProfile).toBe(true)
    expect(selected.coreFixtures).toEqual([{ id: 'first', source: '<first/>', bytes: 8, profileId: 'weapp', options: { syntax: 'legacy', rawTags: ['wxs'] } }])
    expect(fixtures[0]!.options.rawTags).toBeUndefined()
  })

  it.each([{ groups: ['shared'] }, { operations: ['parse'] as const }, { keepGoing: true }, { coreProfile: false }])('rejects formal workload exceptions: %j', (selection) => {
    expect(() => selectRegressionWorkload(fixtures, groups, operations, { check: true, ...selection })).toThrow('Formal regression check rejects')
  })

  it.each([{ groups: [] }, { groups: ['missing'] }, { groups: ['shared', 'shared'] }, { operations: [] }, { operations: ['missing'] as unknown as ProfileOperation[] }, { operations: ['parse', 'parse'] as ProfileOperation[] }])('rejects unknown, empty and duplicate selections: %j', (selection) => {
    expect(() => selectRegressionWorkload(fixtures, groups, operations, { check: false, ...selection })).toThrow('regression')
  })

  it('rejects an empty operation/group intersection and unresolved fixture ids', () => {
    expect(() => selectRegressionWorkload(fixtures, groups, operations, { check: false, groups: ['consumer'], operations: ['scan'] })).toThrow('workload is empty')
    expect(() => selectRegressionWorkload(fixtures.slice(1), groups, operations, { check: false, groups: ['consumer'] })).toThrow('missing fixtures')
  })
})

describe('durable regression stopping', () => {
  it.each(['regression', 'unstable', 'incomplete'] as const)('stops %s only after the failing cell is durably acknowledged', async (status) => {
    const order: string[] = []
    let release!: () => void
    const blocked = new Promise<void>((resolve) => {
      release = resolve
    })
    const reference: CheckpointReference = { runtime: 'node', file: 'node-cells.ndjson', stateFile: 'node-checkpoint.json', status: 'running', completedCells: 0, totalCells: 2, records: 1, bytes: 0, lastSha256: null }
    const handler = regressionCheckpointHandler('node', { reference, append: async () => {
      await blocked
      reference.completedCells++
      reference.lastSha256 = 'durable-tail'
      order.push('durable')
    } }, { keepGoing: false, assertRunning: () => { order.push('signal-check') }, onFailure: async (failure) => {
      expect(failure.checkpoint).toMatchObject({ completedCells: 1, lastSha256: 'durable-tail' })
      order.push('record-failure')
    }, onStop: () => { order.push('stop') } })
    const result = handler(cell(status))
    await Promise.resolve()
    expect(order).toEqual([])
    release()
    await expect(result).rejects.toBeInstanceOf(RegressionStop)
    expect(order).toEqual(['durable', 'record-failure', 'signal-check', 'stop'])
  })

  it('continues diagnostic failures only when explicitly requested, preserving their failure evidence', async () => {
    const onFailure = vi.fn(async () => {})
    const onStop = vi.fn()
    const handler = regressionCheckpointHandler('chromium', { append: async () => {}, reference: {} as CheckpointReference }, { keepGoing: true, assertRunning: () => {}, onFailure, onStop })
    await handler(cell('regression'))
    expect(onFailure).toHaveBeenCalledOnce()
    expect(onStop).not.toHaveBeenCalled()
    expect(regressionCellFailure('node', cell('passed'))).toBeUndefined()
    expect(regressionCellFailure('node', { kind: 'complete', cells: 2, samples: 0, warmupSamples: 0, parity: 0, errors: 0 })).toBeUndefined()
  })

  it('prioritizes interruption and never reports a write failure as a durable regression', async () => {
    const onFailure = vi.fn(async () => {})
    const onStop = vi.fn()
    const options = { keepGoing: false, onFailure, onStop, assertRunning: () => {
      throw new Error('SIGINT')
    } }
    const checkpoint = { append: vi.fn(async () => {}), reference: {} as CheckpointReference }
    await expect(regressionCheckpointHandler('node', checkpoint, options)(cell('regression'))).rejects.toThrow('SIGINT')
    expect(onStop).not.toHaveBeenCalled()
    checkpoint.append.mockRejectedValueOnce(new Error('disk write failed'))
    onFailure.mockClear()
    await expect(regressionCheckpointHandler('node', checkpoint, options)(cell('regression'))).rejects.toThrow('disk write failed')
    expect(onFailure).not.toHaveBeenCalled()
  })
})
