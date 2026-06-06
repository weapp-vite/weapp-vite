import { WEVU_SLOT_OWNER_ID_KEY } from '@weapp-core/constants'
import { describe, expect, it, vi } from 'vitest'
import { shallowRef } from '@/reactivity'
import { createSetDataScheduler } from '@/runtime/app/setData/scheduler'

describe('runtime: setData scheduler', () => {
  it('handles shallowRef null transitions when comparing value tokens', () => {
    const current = shallowRef<any>(null)
    const setData = vi.fn()
    const scheduler = createSetDataScheduler({
      state: { current },
      computedRefs: {},
      dirtyComputedKeys: new Set(),
      includeComputed: false,
      functionPaths: [],
      setDataStrategy: 'diff',
      computedCompare: 'reference',
      computedCompareMaxDepth: 2,
      computedCompareMaxKeys: 20,
      currentAdapter: { setData },
      shouldIncludeKey: () => true,
      maxPatchKeys: 20,
      maxPayloadBytes: 1024 * 32,
      mergeSiblingThreshold: 4,
      mergeSiblingMaxInflationRatio: 2,
      mergeSiblingMaxParentBytes: 1024 * 8,
      mergeSiblingSkipArray: false,
      elevateTopKeyThreshold: 8,
      toPlainMaxDepth: 4,
      toPlainMaxKeys: 50,
      debug: undefined,
      debugWhen: 'fallback',
      debugSampleRate: 1,
      loopWarning: false,
      runTracker: () => {},
      isMounted: () => true,
    })

    expect(() => scheduler.job({})).not.toThrow()
    expect(setData).toHaveBeenCalledWith({ current: null })

    current.value = { id: 'native-ref' }

    expect(() => scheduler.job({})).not.toThrow()
    expect(setData).toHaveBeenLastCalledWith({ current: { id: 'native-ref' } })
  })

  it('keeps runtime initial state over native placeholders during patch initial diff', () => {
    const setData = vi.fn()
    const state = {
      [WEVU_SLOT_OWNER_ID_KEY]: 'wv1',
      tick: 0,
    }
    const scheduler = createSetDataScheduler({
      state,
      computedRefs: {
        __wv_bind_0: { value: { default: true } },
      },
      dirtyComputedKeys: new Set(),
      includeComputed: true,
      functionPaths: [],
      setDataStrategy: 'patch',
      computedCompare: 'reference',
      computedCompareMaxDepth: 2,
      computedCompareMaxKeys: 20,
      currentAdapter: { setData },
      shouldIncludeKey: key => [WEVU_SLOT_OWNER_ID_KEY, '__wv_bind_0', 'tick'].includes(key),
      maxPatchKeys: 20,
      maxPayloadBytes: 1024 * 32,
      mergeSiblingThreshold: 4,
      mergeSiblingMaxInflationRatio: 2,
      mergeSiblingMaxParentBytes: 1024 * 8,
      mergeSiblingSkipArray: false,
      elevateTopKeyThreshold: 8,
      toPlainMaxDepth: 4,
      toPlainMaxKeys: 50,
      debug: undefined,
      debugWhen: 'fallback',
      debugSampleRate: 1,
      loopWarning: false,
      runTracker: () => {},
      isMounted: () => true,
      initialSnapshot: {
        [WEVU_SLOT_OWNER_ID_KEY]: null,
        __wv_bind_0: null,
        tick: 0,
      },
      initialState: {
        [WEVU_SLOT_OWNER_ID_KEY]: 'wv1',
      },
    })

    scheduler.job({})

    expect(state[WEVU_SLOT_OWNER_ID_KEY]).toBe('wv1')
    expect(setData).toHaveBeenCalledWith({
      [WEVU_SLOT_OWNER_ID_KEY]: 'wv1',
      __wv_bind_0: { default: true },
    })
  })

  it('emits a diagnostic event when setData flushes look like a runtime loop', () => {
    const setData = vi.fn()
    const debug = vi.fn()
    const state = { count: 0 }
    const scheduler = createSetDataScheduler({
      state,
      computedRefs: {},
      dirtyComputedKeys: new Set(),
      includeComputed: false,
      functionPaths: [],
      setDataStrategy: 'diff',
      computedCompare: 'reference',
      computedCompareMaxDepth: 2,
      computedCompareMaxKeys: 20,
      currentAdapter: { setData },
      shouldIncludeKey: () => true,
      maxPatchKeys: 20,
      maxPayloadBytes: 1024 * 32,
      mergeSiblingThreshold: 4,
      mergeSiblingMaxInflationRatio: 2,
      mergeSiblingMaxParentBytes: 1024 * 8,
      mergeSiblingSkipArray: false,
      elevateTopKeyThreshold: 8,
      toPlainMaxDepth: 4,
      toPlainMaxKeys: 50,
      debug,
      debugWhen: 'fallback',
      debugSampleRate: 1,
      loopWarning: {
        sampleWindowMs: 1000,
        maxFlushes: 2,
        coolDownMs: 0,
      },
      runTracker: () => {},
      isMounted: () => true,
    })

    scheduler.job({})
    state.count = 1
    scheduler.job({})
    state.count = 2
    scheduler.job({})

    expect(debug).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'loopWarning',
      flushCount: 3,
      windowMs: 1000,
      pendingPatchKeys: 0,
      computedDirtyKeys: 0,
    }))
  })
})
