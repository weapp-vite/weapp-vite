import type { ProfileCheckpoint, ProfileDependencies, ProfileFixture, ProfileGroup } from './types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { measureProfile, measureProfileWithCheckpoint } from './measure'
import { regressionCheckpointHandler, RegressionStop } from './regressionSelection'

const runtimeRun = vi.hoisted(() => vi.fn())
vi.mock('./operations', () => ({ createProfileRuntime: () => ({ run: runtimeRun, select: (operation: string, arm: string) => (fixture: unknown) => runtimeRun(fixture, operation, arm), prepare: () => [], verifyOperation: () => {}, candidateTrees: new Map() }) }))
vi.mock('../../benchmarkWxmlParser/calibration', () => ({ calibrateBatch: () => ({ iterations: 1, candidateResolved: true, probes: [] }) }))

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

const fixture = { id: 'fixture', bytes: 7, comparison: { eligible: true } } as ProfileFixture
const groups: ProfileGroup[] = [
  { id: 'selected', fixtureIds: [fixture.id], comparable: true, operations: ['parse'] },
  { id: 'omitted', fixtureIds: [fixture.id], comparable: true },
]
const run = (progress?: boolean) => measureProfile({} as ProfileDependencies, [fixture], groups, { rounds: 1, warmup: 0, groups: ['selected'], operations: ['scan', 'parse', 'canonical'], progress })

describe('regression cell progress', () => {
  it('keeps existing profile calls silent by default', () => {
    const output = vi.spyOn(console, 'info').mockImplementation(() => {})
    expect(run().summaries).toHaveLength(1)
    expect(output).not.toHaveBeenCalled()
  })

  it('prints one completed-cell event after the selected operation and group', () => {
    const output = vi.spyOn(console, 'info').mockImplementation(() => {})
    expect(run(true).summaries).toHaveLength(1)
    expect(output).toHaveBeenCalledOnce()
    expect(output.mock.calls[0]![0]).toMatch(/^\[wxml-regression\] 1\/1 parse selected complete ratio=[\d.]+ baseline=[\d.]+ms candidate=[\d.]+ms$/)
  })

  it('waits for durable checkpoint acknowledgement before any next-cell operation', async () => {
    let release!: () => void
    const blocked = new Promise<void>((resolve) => {
      release = resolve
    })
    const records: ProfileCheckpoint[] = []
    const work = measureProfileWithCheckpoint({} as ProfileDependencies, [fixture], groups, { rounds: 1, warmup: 0, groups: ['selected'], operations: ['parse'], gate: { aggregateGroupSuffix: '/all', aggregateMaximumRatio: 1.03, categoryMaximumRatio: 1.05 } }, async (record) => {
      records.push(record)
      if (record.kind === 'start') {
        await blocked
      }
    })
    const before = runtimeRun.mock.calls.length
    await Promise.resolve()
    expect(records.map(record => record.kind)).toEqual(['start'])
    expect(runtimeRun).toHaveBeenCalledTimes(before)
    release()
    const result = await work
    expect(records.map(record => record.kind)).toEqual(['start', 'cell', 'complete'])
    const cell = records[1] as Extract<ProfileCheckpoint, { kind: 'cell' }>
    expect(cell.samples).toEqual(result.samples)
    expect(cell.summary).toEqual(result.summaries[0])
    expect(cell.parity).toEqual(result.parity)
  })

  it('does not execute a later cell or emit completion after the first durable incomplete cell', async () => {
    runtimeRun.mockImplementation(() => {
      throw new Error('controlled operation failure')
    })
    const records: ProfileCheckpoint[] = []
    const onStop = vi.fn()
    const checkpoint = regressionCheckpointHandler('node', { reference: {} as Parameters<typeof regressionCheckpointHandler>[1]['reference'], append: async (record) => {
      records.push(record)
    } }, { keepGoing: false, assertRunning: () => {}, onFailure: async () => {}, onStop })
    await expect(measureProfileWithCheckpoint({} as ProfileDependencies, [fixture], groups, { rounds: 1, warmup: 0, operations: ['parse'] }, checkpoint)).rejects.toBeInstanceOf(RegressionStop)
    expect(records.map(record => record.kind)).toEqual(['start', 'cell'])
    expect(onStop).toHaveBeenCalledWith(expect.objectContaining({ operation: 'parse', group: 'selected', status: 'incomplete' }))
    expect(runtimeRun).toHaveBeenCalledTimes(3)
  })
})
