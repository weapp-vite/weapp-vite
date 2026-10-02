import type { SetDataAdapterSettler, SetDataCommitTracker } from '@/runtime/app/setData/commitTracker'
import type { InternalRuntimeState, SetDataDebugInfo } from '@/runtime/types'
import { Buffer } from 'node:buffer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from '@/index'
import { createSetDataCommitTracker } from '@/runtime/app/setData/commitTracker'
import { createSetDataObservation } from '@/runtime/app/setData/observation'
import { mountRuntimeInstance, setRuntimeSetDataVisibility, teardownRuntimeInstance } from '@/runtime/register/runtimeInstance'

describe('runtime: setData phase diagnostics', () => {
  afterEach(() => vi.restoreAllMocks())

  it('includes phase boundaries in the built-in diagnostic logger', () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {})
    const app = createApp({ data: () => ({ count: 0 }), setData: { debugPhases: true, diagnostics: 'always' } })
    const runtime = app.mount({ setData() {} })
    expect(log.mock.calls.some(([message]) => String(message).includes('phase=commit') && String(message).includes('completion=return'))).toBe(true)
    expect(log.mock.calls.some(([message]) => String(message).includes('visibleAt=unknown'))).toBe(true)
    runtime.unmount()
  })

  it('does not count synthetic native completion as a physical setData call', async () => {
    const events: SetDataDebugInfo[] = []
    const target = { data: { count: 0 } } satisfies InternalRuntimeState
    const app = createApp({
      data: () => ({ count: 0 }),
      setData: { debugPhases: true, debugWhen: 'always', debug: info => events.push(info) },
    })
    const runtime = mountRuntimeInstance(target, app, undefined, undefined)
    runtime.state.count = 1
    await nextTick()
    expect(events.filter(info => info.phase).map(info => info.phase?.name)).toEqual(['prepare', 'commit'])
    expect(events.at(-1)).toMatchObject({ phase: { completion: 'unknown', dispatch: null, commitDurationMs: null } })
    teardownRuntimeInstance(target)
  })

  it('retains recovery started from an abandoned phase callback', () => {
    let tracker: SetDataCommitTracker
    const settlements: SetDataAdapterSettler[] = []
    const update = (count: number, full = false) => tracker.dispatch({
      mode: 'diff',
      reason: full ? 'needsFullSnapshot' : 'diff',
      kind: full ? 'full' : 'delta',
      snapshot: { count },
      payload: { count },
      pendingPatchKeys: 0,
    })
    const observation = createSetDataObservation({
      debugWhen: 'always',
      debugSampleRate: 1,
      committedRevision: () => tracker.state.committedRevision,
      debug(info) {
        if (info.phase?.result === 'abandoned') {
          update(3, true)
        }
      },
    })
    tracker = createSetDataCommitTracker({
      adapter: { __wevu_dispatchSetData: (_payload, settle) => { settlements.push(settle) } },
      observe: observation.revision,
      onFailure: vi.fn(),
    })
    update(1)
    update(2)
    settlements[0]!('failed')
    expect(settlements).toHaveLength(3)
    settlements[2]!('committed')
    expect(tracker.state.committedRevision).toBe(3)
    expect(tracker.state.needsFullSnapshot).toBe(false)
  })

  it('reports synchronous throw and keeps missing or reversed timing unknown', () => {
    const events: SetDataDebugInfo[] = []
    vi.spyOn(Date, 'now').mockReturnValueOnce(10).mockReturnValue(5)
    const app = createApp({
      data: () => ({ count: 0 }),
      setData: { loopWarning: false, debugPhases: true, debugWhen: 'always', debug: info => events.push(info) },
    })
    const runtime = app.mount({ setData() {
      throw new Error('synchronous host failure')
    } })
    expect(events.find(info => info.phase?.name === 'commit')).toMatchObject({ phase: {
      result: 'failed',
      completion: 'throw',
      prepareDurationMs: null,
      visibleAt: null,
    } })
    runtime.unmount()
  })

  it('keeps late revisions and repeated recovery failures distinct', () => {
    const events: SetDataDebugInfo[] = []
    const settlements: SetDataAdapterSettler[] = []
    let tracker: SetDataCommitTracker
    const observation = createSetDataObservation({
      debug: info => events.push(info),
      debugWhen: 'always',
      debugSampleRate: 1,
      committedRevision: () => tracker.state.committedRevision,
    })
    tracker = createSetDataCommitTracker({
      adapter: { __wevu_dispatchSetData: (_payload, settle) => { settlements.push(settle) } },
      onFailure: vi.fn(),
      observe: observation.revision,
    })
    const dispatch = (count: number, full = false) => {
      observation.prepare()
      tracker.dispatch({ snapshot: { count }, payload: { count }, mode: 'diff', kind: full ? 'full' : 'delta', reason: full ? 'needsFullSnapshot' : 'diff', pendingPatchKeys: 0 })
    }
    dispatch(1)
    dispatch(2)
    settlements[0]!('failed', new Error('first'))
    dispatch(3, true)
    settlements[2]!('failed', new Error('second'))
    dispatch(4, true)
    settlements[3]!('committed')
    settlements[1]!('committed')
    dispatch(5, true)
    tracker.dispose()
    const terminal = events.filter(info => info.phase?.name === 'commit')
    expect(terminal.map(info => [info.revision, info.phase?.result])).toEqual([
      [2, 'abandoned'],
      [1, 'failed'],
      [3, 'failed'],
      [4, 'committed'],
      [2, 'out-of-order'],
      [5, 'disposed'],
    ])
    expect(terminal.at(-2)).toMatchObject({ committedRevision: 4, phase: { completion: 'unknown', dispatch: null, commitDurationMs: null } })
    expect(tracker.state.needsFullSnapshot).toBe(true)
  })

  it('samples entire phase sequences and isolates diagnostic exceptions', async () => {
    const events: SetDataDebugInfo[] = []
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.25)
    let complete: (() => void) | undefined
    const app = createApp({
      data: () => ({ count: 0 }),
      setData: { debugPhases: true, debugWhen: 'always', debugSampleRate: 0.5, debug(info) {
        events.push(info)
        throw new Error('diagnostic consumer')
      } },
    })
    const runtime = app.mount({ setData: () => new Promise<void>((resolve) => {
      complete = resolve
    }) })
    random.mockReturnValue(0.75)
    complete?.()
    await nextTick()
    expect(events.filter(info => info.phase).map(info => info.phase?.name)).toEqual(['prepare', 'dispatch', 'commit'])
    runtime.state.count = 1
    await nextTick()
    complete?.()
    await nextTick()
    expect(events.filter(info => info.phase)).toHaveLength(3)
    runtime.unmount()
  })

  it('does not read the clock, sample, or serialize payloads when observation is off', async () => {
    const now = vi.spyOn(Date, 'now')
    const random = vi.spyOn(Math, 'random')
    const stringify = vi.spyOn(JSON, 'stringify')
    const debug = vi.fn()
    const app = createApp({ data: () => ({ count: 0 }), setData: { debug, debugWhen: 'always', loopWarning: false } })
    const runtime = app.mount({ setData: vi.fn() })
    runtime.state.count = 1
    await nextTick()
    expect(now).not.toHaveBeenCalled()
    expect(random).not.toHaveBeenCalled()
    expect(stringify).not.toHaveBeenCalled()
    expect(debug.mock.calls.some(([info]) => info.phase)).toBe(false)
    runtime.unmount()
  })

  it('observes delayed callback completion without changing global nextTick', async () => {
    const events: SetDataDebugInfo[] = []
    let complete: (() => void) | undefined
    const target = {
      data: { count: 0 },
      setData: (_payload: Record<string, unknown>, callback: () => void) => { complete = callback },
    } satisfies InternalRuntimeState
    const app = createApp({
      data: () => ({ count: 0 }),
      setData: { debugPhases: true, debugWhen: 'always', debug: info => events.push(info) },
    })
    const runtime = mountRuntimeInstance(target, app, undefined, undefined)
    runtime.state.count = 1
    await nextTick()
    expect(events.filter(info => info.phase).map(info => info.phase?.name)).toEqual(['prepare', 'dispatch'])
    complete?.()
    const commit = events.find(info => info.phase?.name === 'commit')!
    expect(commit).toMatchObject({ revision: 1, committedRevision: 1, phase: {
      result: 'committed',
      completion: 'callback',
      visibleAt: null,
    } })
    expect(commit.phase?.dispatch?.payloadBytes).toBe(11)
    teardownRuntimeInstance(target)
  })

  it('associates hidden revisions with one physical call and its merged bytes', async () => {
    const events: SetDataDebugInfo[] = []
    let complete: (() => void) | undefined
    const target = {
      data: { count: 0, label: '' },
      setData: vi.fn((_payload: Record<string, unknown>, callback: () => void) => { complete = callback }),
    } satisfies InternalRuntimeState
    const app = createApp({
      data: () => ({ count: 0, label: '' }),
      setData: { suspendWhenHidden: true, debugPhases: true, debugWhen: 'always', debug: info => events.push(info) },
    })
    const runtime = mountRuntimeInstance(target, app, undefined, undefined)
    setRuntimeSetDataVisibility(target, false)
    runtime.state.count = 1
    await nextTick()
    runtime.state.label = '中😀'
    await nextTick()
    expect(target.setData).not.toHaveBeenCalled()
    expect(events.filter(info => info.phase?.name === 'prepare')).toHaveLength(2)
    setRuntimeSetDataVisibility(target, true)
    expect(target.setData).toHaveBeenCalledTimes(1)
    const dispatches = events.filter(info => info.phase?.name === 'dispatch')
    expect(dispatches).toHaveLength(2)
    expect(dispatches[0]!.phase!.dispatch).toEqual(dispatches[1]!.phase!.dispatch)
    expect(dispatches[0]!.phase!.dispatch?.payloadBytes).toBe(Buffer.byteLength(JSON.stringify({ count: 1, label: '中😀' })))
    complete?.()
    expect(events.filter(info => info.phase?.name === 'commit').map(info => info.phase?.result)).toEqual(['committed', 'committed'])
    teardownRuntimeInstance(target)
  })

  it('distinguishes synchronous return from promise completion and failed recovery', async () => {
    const events: SetDataDebugInfo[] = []
    let reject: ((cause: unknown) => void) | undefined
    let fail = true
    const app = createApp({
      data: () => ({ count: 0 }),
      setData: { debugPhases: true, debugWhen: 'always', debug: info => events.push(info) },
    })
    const runtime = app.mount({ setData: () => fail
      ? new Promise<void>((_resolve, rejectPromise) => {
          reject = rejectPromise
        })
      : undefined })
    reject?.(new Error('host rejected'))
    await nextTick()
    expect(events.find(info => info.phase?.name === 'commit')).toMatchObject({ phase: { result: 'failed', completion: 'promise', visibleAt: null } })
    fail = false
    runtime.state.count = 1
    await nextTick()
    expect(events.filter(info => info.phase?.name === 'commit').at(-1)).toMatchObject({
      reason: 'needsFullSnapshot',
      committedRevision: 2,
      phase: { result: 'committed', completion: 'return', visibleAt: null },
    })
    runtime.unmount()
  })
})
