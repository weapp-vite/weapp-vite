import { describe, expect, it, vi } from 'vitest'
import { measureUpdate } from './runtimeBench/update'

function fixture() {
  const state = {
    cardCount: 1,
    firstCardTitle: 'First card',
    summary: 'final summary',
    metrics: { singleCommitMs: 10, singleCommitCommitMs: 999, singleCommitDispatchMs: 999, singleCommitFlushMs: 2, singleCommitSetDataCalls: 1 },
    measurement: { phases: { revisions: 1, dispatches: 1, failed: 0, pending: 0, commitMs: 7, dispatchMs: 1, events: [] } },
  }
  const page = {
    waitFor: vi.fn(async () => {}),
    callMethod: vi.fn(async (name: string) => name === 'readUpdateBenchObservation'
      ? state
      : { ...state, measurement: { phases: { revisions: 1, pending: 1 } } }),
    $: vi.fn(async (selector: string) => ({ text: async () => selector === '#bench-visible-marker' ? state.summary : state.firstCardTitle })),
    $$: vi.fn(async () => [{}]),
  }
  const miniProgram = { reLaunch: vi.fn(async () => page) }
  const session = { run: async <T>(_label: string, operation: (value: typeof miniProgram) => Promise<T>) => operation(miniProgram), close: async () => {} }
  return { state, page, session }
}

describe('runtime benchmark update observation', () => {
  it('waits for revision evidence and verifies rendered state separately from nextTick', async () => {
    const { page, session } = fixture()
    const result = await measureUpdate({ session, route: '/pages/update/index', method: 'runSingleCommitBench', rounds: 1, sampleCount: 1, requirePhases: true, log: () => {} })
    expect(result.commitMsMedian).toBe(7)
    expect(result.dispatchMsMedian).toBe(1)
    expect(result.flushMsMedian).toBe(2)
    expect(result.setDataDiagnosticsMedian.avgBytes).toBeNull()
    expect(result.samples).toHaveLength(1)
    expect(result.samples![0]!.visible).toMatchObject({ summary: 'final summary', cardCount: 1, firstCardTitle: 'First card' })
    expect(page.callMethod).toHaveBeenCalledWith('readUpdateBenchObservation')
  })

  it('does not report unsupported legacy timing fields as observed commit/dispatch', async () => {
    const { session } = fixture()
    const result = await measureUpdate({ session, route: '/pages/update/index', method: 'runSingleCommitBench', rounds: 1, sampleCount: 1, requirePhases: false, log: () => {} })
    expect(result.commitMsMedian).toBeNull()
    expect(result.dispatchMsMedian).toBeNull()
    expect(result.samples![0]!.visible).toBeUndefined()
  })

  it('fails the sample when a revision failed instead of publishing success', async () => {
    const { state, session } = fixture()
    state.measurement.phases.failed = 1
    await expect(measureUpdate({ session, route: '/pages/update/index', method: 'runSingleCommitBench', rounds: 1, sampleCount: 1, requirePhases: true, log: () => {} })).rejects.toThrow('Benchmark revision failed')
  })
})
