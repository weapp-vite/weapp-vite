import type { PreparedSetDataUpdate, SetDataAdapterSettler, SetDataCommitTracker, SetDataPayload, SetDataSnapshot } from '@/runtime/app/setData/commitTracker'
import { describe, expect, it, vi } from 'vitest'
import { createSetDataCommitTracker, observeSetDataCompletion } from '@/runtime/app/setData/commitTracker'

function createUpdate(
  snapshot: SetDataSnapshot,
  payload: SetDataPayload = snapshot,
  kind: PreparedSetDataUpdate['kind'] = 'delta',
): PreparedSetDataUpdate {
  return {
    mode: 'diff',
    kind,
    reason: kind === 'full' ? 'needsFullSnapshot' : 'diff',
    snapshot,
    payload,
    pendingPatchKeys: 0,
  }
}

describe('runtime: setData commit tracker', () => {
  it('commits synchronous void adapters without allocating an async barrier', () => {
    const setData = vi.fn()
    const tracker = createSetDataCommitTracker({
      initialSnapshot: { count: 0 },
      adapter: { setData },
      onFailure: vi.fn(),
    })
    const resolvedBarrier = tracker.state.commitPromise

    expect(tracker.dispatch(createUpdate({ count: 1 }, { count: 1 }))).toBe(1)

    expect(setData).toHaveBeenCalledWith({ count: 1 })
    expect(tracker.state.committedRevision).toBe(1)
    expect(tracker.state.committedSnapshot).toEqual({ count: 1 })
    expect(tracker.state.commitPromise).toBe(resolvedBarrier)
  })

  it('advances committed snapshots through ordered concurrent completion', async () => {
    const settlements: SetDataAdapterSettler[] = []
    const tracker = createSetDataCommitTracker({
      initialSnapshot: { count: 0 },
      adapter: {
        __wevu_dispatchSetData(_payload, settle) {
          settlements.push(settle)
        },
      },
      onFailure: vi.fn(),
    })

    tracker.dispatch(createUpdate({ count: 1 }, { count: 1 }))
    tracker.dispatch(createUpdate({ count: 2 }, { count: 2 }))
    const barrier = tracker.state.commitPromise

    expect(settlements).toHaveLength(2)
    expect(tracker.state.committedRevision).toBe(0)
    settlements[0]!('committed')
    expect(tracker.state.committedRevision).toBe(1)
    expect(tracker.state.committedSnapshot).toEqual({ count: 1 })
    settlements[1]!('committed')
    await expect(barrier).resolves.toBeUndefined()
    expect(tracker.state.committedRevision).toBe(2)
    expect(tracker.state.committedSnapshot).toEqual({ count: 2 })
  })

  it('freezes an overtaken lineage and recovers with a newer full checkpoint', () => {
    const settlements: SetDataAdapterSettler[] = []
    const onFailure = vi.fn()
    const tracker = createSetDataCommitTracker({
      initialSnapshot: { count: 0 },
      adapter: {
        __wevu_dispatchSetData(_payload, settle) {
          settlements.push(settle)
        },
      },
      onFailure,
    })

    tracker.dispatch(createUpdate({ count: 1 }, { count: 1 }))
    tracker.dispatch(createUpdate({ count: 2 }, { count: 2 }))
    settlements[1]!('committed')
    expect(tracker.state.committedRevision).toBe(0)

    settlements[0]!('committed')
    expect(tracker.state.committedRevision).toBe(0)
    expect(tracker.state.needsFullSnapshot).toBe(true)
    expect(onFailure).toHaveBeenCalledTimes(1)
    expect(onFailure).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'out-of-order',
      revision: 1,
      committedRevision: 0,
    }))

    tracker.dispatch(createUpdate({ count: 2 }, { count: 2 }, 'full'))
    settlements[2]!('committed')
    expect(tracker.state.committedRevision).toBe(3)
    expect(tracker.state.committedSnapshot).toEqual({ count: 2 })
    expect(tracker.state.needsFullSnapshot).toBe(false)
  })

  it('invalidates pending deltas after a late old success', async () => {
    const settlements: SetDataAdapterSettler[] = []
    const onFailure = vi.fn()
    const tracker = createSetDataCommitTracker({
      initialSnapshot: { branch: { a: 0, b: 0 } },
      adapter: {
        __wevu_dispatchSetData(_payload, settle) {
          settlements.push(settle)
        },
      },
      onFailure,
    })

    tracker.dispatch(createUpdate(
      { branch: { a: 1, b: 0 } },
      { 'branch.a': 1 },
    ))
    tracker.dispatch(createUpdate(
      { branch: { a: 2, b: 0 } },
      { branch: { a: 2, b: 0 } },
      'full',
    ))
    settlements[1]!('committed')
    expect(tracker.state.committedRevision).toBe(2)

    tracker.dispatch(createUpdate(
      { branch: { a: 2, b: 1 } },
      { 'branch.b': 1 },
    ))
    const pendingBarrier = tracker.state.commitPromise
    settlements[0]!('committed')

    expect(tracker.state.committedRevision).toBe(2)
    expect(tracker.state.needsFullSnapshot).toBe(true)
    expect(onFailure).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'out-of-order',
      revision: 1,
      committedRevision: 2,
    }))
    await expect(pendingBarrier).resolves.toBeUndefined()

    settlements[2]!('committed')
    expect(tracker.state.committedRevision).toBe(2)
    expect(tracker.state.committedSnapshot).toEqual({ branch: { a: 2, b: 0 } })
    expect(tracker.state.needsFullSnapshot).toBe(true)
  })

  it('keeps failed and invalidated deltas out of committed state', async () => {
    const settlements: SetDataAdapterSettler[] = []
    const onFailure = vi.fn()
    const tracker = createSetDataCommitTracker({
      initialSnapshot: { branch: { a: 0, b: 0 } },
      adapter: {
        __wevu_dispatchSetData(_payload, settle) {
          settlements.push(settle)
        },
      },
      onFailure,
    })

    tracker.dispatch(createUpdate(
      { branch: { a: 1, b: 0 } },
      { 'branch.a': 1 },
    ))
    tracker.dispatch(createUpdate(
      { branch: { a: 1, b: 1 } },
      { 'branch.b': 1 },
    ))
    const failedLineageBarrier = tracker.state.commitPromise
    const cause = new Error('host rejected')
    settlements[0]!('failed', cause)
    settlements[1]!('committed')

    expect(tracker.state.committedRevision).toBe(0)
    expect(tracker.state.committedSnapshot).toEqual({ branch: { a: 0, b: 0 } })
    expect(tracker.state.needsFullSnapshot).toBe(true)
    expect(onFailure).toHaveBeenCalledTimes(1)
    expect(onFailure).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'adapter',
      cause,
      revision: 1,
    }))
    await expect(failedLineageBarrier).resolves.toBeUndefined()

    tracker.dispatch(createUpdate(
      { branch: { a: 1, b: 1 } },
      { branch: { a: 1, b: 1 } },
      'full',
    ))
    settlements[2]!('committed')
    expect(tracker.state.committedRevision).toBe(3)
    expect(tracker.state.needsFullSnapshot).toBe(false)
  })

  it('invalidates failed lineage when the rejection reason cannot be stringified', async () => {
    const settlements: SetDataAdapterSettler[] = []
    const onFailure = vi.fn()
    const tracker = createSetDataCommitTracker({
      initialSnapshot: { count: 0 },
      adapter: {
        __wevu_dispatchSetData(_payload, settle) {
          settlements.push(settle)
        },
      },
      onFailure,
    })
    const cause = {
      toString() {
        throw new Error('cannot stringify')
      },
    }

    tracker.dispatch(createUpdate({ count: 1 }, { count: 1 }))
    const barrier = tracker.state.commitPromise
    settlements[0]!('failed', cause)

    await expect(barrier).resolves.toBeUndefined()
    expect(tracker.state.committedRevision).toBe(0)
    expect(tracker.state.needsFullSnapshot).toBe(true)
    expect(onFailure).toHaveBeenCalledWith(expect.objectContaining({
      cause,
      error: expect.objectContaining({
        message: expect.stringContaining('<unprintable cause>'),
      }),
    }))
  })

  it('re-arms recovery when an invalidated old success arrives after a newer commit', () => {
    const settlements: SetDataAdapterSettler[] = []
    const onFailure = vi.fn()
    const tracker = createSetDataCommitTracker({
      initialSnapshot: { count: 0 },
      adapter: {
        __wevu_dispatchSetData(_payload, settle) {
          settlements.push(settle)
        },
      },
      onFailure,
    })

    tracker.dispatch(createUpdate({ count: 1 }, { count: 1 }))
    tracker.dispatch(createUpdate({ count: 2 }, { count: 2 }))
    settlements[0]!('failed', new Error('first failed'))
    tracker.dispatch(createUpdate({ count: 3 }, { count: 3 }, 'full'))
    settlements[2]!('committed')
    expect(tracker.state.committedRevision).toBe(3)
    expect(tracker.state.needsFullSnapshot).toBe(false)

    settlements[1]!('committed')
    expect(tracker.state.committedRevision).toBe(3)
    expect(tracker.state.committedSnapshot).toEqual({ count: 3 })
    expect(tracker.state.needsFullSnapshot).toBe(true)
    expect(onFailure).toHaveBeenLastCalledWith(expect.objectContaining({
      kind: 'out-of-order',
      revision: 2,
      committedRevision: 3,
    }))
  })

  it('preserves a recovery dispatch started re-entrantly by out-of-order reporting', async () => {
    const settlements: SetDataAdapterSettler[] = []
    let tracker: SetDataCommitTracker
    const onFailure = vi.fn((failure) => {
      if (failure.kind === 'out-of-order') {
        expect(tracker.state.needsFullSnapshot).toBe(true)
        tracker.dispatch(createUpdate({ count: 5 }, { count: 5 }, 'full'))
      }
    })
    tracker = createSetDataCommitTracker({
      initialSnapshot: { count: 0 },
      adapter: {
        __wevu_dispatchSetData(_payload, settle) {
          settlements.push(settle)
        },
      },
      onFailure,
    })

    tracker.dispatch(createUpdate({ count: 1 }, { count: 1 }))
    tracker.dispatch(createUpdate({ count: 2 }, { count: 2 }))
    settlements[0]!('failed', new Error('first failed'))
    tracker.dispatch(createUpdate({ count: 3 }, { count: 3 }, 'full'))
    settlements[2]!('committed')
    tracker.dispatch(createUpdate({ count: 4 }, { count: 4 }))
    const invalidatedBarrier = tracker.state.commitPromise

    settlements[1]!('committed')

    await expect(invalidatedBarrier).resolves.toBeUndefined()
    expect(settlements).toHaveLength(5)
    expect(tracker.state.committedRevision).toBe(3)
    expect(tracker.state.needsFullSnapshot).toBe(true)
    settlements[4]!('committed')
    expect(tracker.state.committedRevision).toBe(5)
    expect(tracker.state.committedSnapshot).toEqual({ count: 5 })
    expect(tracker.state.needsFullSnapshot).toBe(false)
  })

  it('reports a late old failure without regressing or invalidating a newer full commit', () => {
    const settlements: SetDataAdapterSettler[] = []
    const onFailure = vi.fn()
    const tracker = createSetDataCommitTracker({
      initialSnapshot: { count: 0 },
      adapter: {
        __wevu_dispatchSetData(_payload, settle) {
          settlements.push(settle)
        },
      },
      onFailure,
    })

    tracker.dispatch(createUpdate({ count: 1 }, { count: 1 }))
    tracker.dispatch(createUpdate({ count: 2 }, { count: 2 }))
    settlements[0]!('failed', new Error('first failed'))
    tracker.dispatch(createUpdate({ count: 3 }, { count: 3 }, 'full'))
    settlements[2]!('committed')
    const lateCause = new Error('late old failure')

    settlements[1]!('failed', lateCause)
    expect(tracker.state.committedRevision).toBe(3)
    expect(tracker.state.committedSnapshot).toEqual({ count: 3 })
    expect(tracker.state.needsFullSnapshot).toBe(false)
    expect(onFailure).toHaveBeenLastCalledWith(expect.objectContaining({
      kind: 'adapter',
      revision: 2,
      committedRevision: 3,
      cause: lateCause,
    }))
  })

  it('keeps recovery sticky until a full checkpoint succeeds', () => {
    const settlements: SetDataAdapterSettler[] = []
    const tracker = createSetDataCommitTracker({
      initialSnapshot: { count: 0 },
      adapter: {
        __wevu_dispatchSetData(_payload, settle) {
          settlements.push(settle)
        },
      },
      onFailure: vi.fn(),
    })

    tracker.dispatch(createUpdate({ count: 1 }, { count: 1 }))
    settlements[0]!('failed', new Error('delta failed'))
    tracker.dispatch(createUpdate({ count: 2 }, { count: 2 }, 'full'))
    settlements[1]!('failed', new Error('recovery failed'))
    expect(tracker.state.committedRevision).toBe(0)
    expect(tracker.state.needsFullSnapshot).toBe(true)

    tracker.dispatch(createUpdate({ count: 3 }, { count: 3 }, 'full'))
    settlements[2]!('committed')
    expect(tracker.state.committedRevision).toBe(3)
    expect(tracker.state.committedSnapshot).toEqual({ count: 3 })
    expect(tracker.state.needsFullSnapshot).toBe(false)
  })

  it('includes historical top-level tombstones in full recovery payloads', () => {
    const tracker = createSetDataCommitTracker({
      initialSnapshot: { keep: 1, removed: 1 },
      adapter: { setData: vi.fn() },
      onFailure: vi.fn(),
    })

    tracker.dispatch(createUpdate(
      { keep: 2, added: 1 },
      { keep: 2, added: 1 },
    ))

    expect(tracker.createFullPayload({ keep: 3 })).toEqual({
      keep: 3,
      removed: null,
      added: null,
    })
  })

  it('prefers a returned thenable over a synchronous callback', async () => {
    let reject: ((cause: unknown) => void) | undefined
    const promise = new Promise<void>((_resolve, rejectPromise) => {
      reject = rejectPromise
    })
    const settle = vi.fn()

    observeSetDataCompletion({
      invoke(callback) {
        callback()
        return promise
      },
      completion: 'callback',
      settle,
    })
    expect(settle).not.toHaveBeenCalled()

    const cause = new Error('render failed')
    reject?.(cause)
    await promise.catch(() => undefined)
    expect(settle).toHaveBeenCalledTimes(1)
    expect(settle).toHaveBeenCalledWith('failed', cause)
  })

  it('keeps an asynchronous callback subordinate to the returned thenable', async () => {
    let callback: (() => void) | undefined
    let reject: ((cause: unknown) => void) | undefined
    const promise = new Promise<void>((_resolve, rejectPromise) => {
      reject = rejectPromise
    })
    const settle = vi.fn()

    observeSetDataCompletion({
      invoke(nextCallback) {
        callback = nextCallback
        return promise
      },
      completion: 'callback',
      settle,
    })
    callback?.()
    expect(settle).not.toHaveBeenCalled()

    const cause = new Error('late render failure')
    reject?.(cause)
    await promise.catch(() => undefined)
    expect(settle).toHaveBeenCalledTimes(1)
    expect(settle).toHaveBeenCalledWith('failed', cause)
  })

  it('fulfills pending barriers and ignores late completion after disposal', async () => {
    let settle: SetDataAdapterSettler | undefined
    const tracker = createSetDataCommitTracker({
      initialSnapshot: { count: 0 },
      adapter: {
        __wevu_dispatchSetData(_payload, nextSettle) {
          settle = nextSettle
        },
      },
      onFailure: vi.fn(),
    })

    tracker.dispatch(createUpdate({ count: 1 }, { count: 1 }))
    const barrier = tracker.state.commitPromise
    tracker.dispose()
    await expect(barrier).resolves.toBeUndefined()
    settle?.('committed')

    expect(tracker.state.disposed).toBe(true)
    expect(tracker.state.committedRevision).toBe(0)
  })
})
