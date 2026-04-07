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
      runTracker: () => {},
      isMounted: () => true,
    })

    expect(() => scheduler.job({})).not.toThrow()
    expect(setData).toHaveBeenCalledWith({ current: null })

    current.value = { id: 'native-ref' }

    expect(() => scheduler.job({})).not.toThrow()
    expect(setData).toHaveBeenLastCalledWith({ current: { id: 'native-ref' } })
  })
})
