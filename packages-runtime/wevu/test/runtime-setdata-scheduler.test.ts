import type { WevuRuntimeBindingManifestV1 } from '@weapp-core/constants'
import type { MutationRecord } from '@/reactivity'
import type { CommitAwareSetDataAdapter, SetDataPayload } from '@/runtime/app/setData/commitTracker'
import type { SetDataDebugInfo } from '@/runtime/types'
import { WEVU_SLOT_OWNER_ID_KEY } from '@weapp-core/constants'
import { describe, expect, it, vi } from 'vitest'
import { reactive, shallowRef, toRaw } from '@/reactivity'
import { createSetDataScheduler } from '@/runtime/app/setData/scheduler'
import { resolveBindingDiagnostics, resolveBindingManifest } from '@/runtime/bindingManifest'

function createScheduler(options: {
  state: Record<string, unknown>
  strategy: 'diff' | 'patch'
  adapter: CommitAwareSetDataAdapter
  initialSnapshot?: Record<string, unknown>
  debug?: (info: SetDataDebugInfo) => void
  debugSampleRate?: number
}) {
  const root = toRaw(options.state) as object
  const scheduler = createSetDataScheduler({
    state: options.state,
    computedRefs: {},
    dirtyComputedKeys: new Set(),
    includeComputed: false,
    functionPaths: [],
    setDataStrategy: options.strategy,
    computedCompare: 'reference',
    computedCompareMaxDepth: 2,
    computedCompareMaxKeys: 20,
    currentAdapter: options.adapter,
    shouldIncludeKey: () => true,
    maxPatchKeys: 20,
    maxPayloadBytes: 1024 * 32,
    mergeSiblingThreshold: 4,
    mergeSiblingMaxInflationRatio: 2,
    mergeSiblingMaxParentBytes: 1024 * 8,
    mergeSiblingSkipArray: false,
    elevateTopKeyThreshold: 8,
    toPlainMaxDepth: 8,
    toPlainMaxKeys: 100,
    debug: options.debug,
    debugWhen: 'fallback',
    debugSampleRate: options.debugSampleRate ?? 1,
    loopWarning: false,
    runTracker: () => {},
    isMounted: () => true,
    initialSnapshot: options.initialSnapshot,
  })
  return { root, scheduler }
}

interface PatchMutationRecorder {
  mutationRecorder: (record: MutationRecord, stateRootRaw: object) => void
}

function recordPatch(
  scheduler: PatchMutationRecorder,
  root: object,
  path: string,
) {
  scheduler.mutationRecorder({
    root,
    kind: 'property',
    op: 'set',
    path,
  }, root)
}

describe('runtime: setData scheduler', () => {
  it('handles shallowRef null transitions when comparing value tokens', () => {
    const current = shallowRef<unknown>(null)
    const setData = vi.fn()
    const { scheduler, root } = createScheduler({
      state: { current },
      strategy: 'diff',
      adapter: { setData },
    })

    expect(scheduler.job(root)).toBeUndefined()
    expect(setData).toHaveBeenCalledWith({ current: null })

    current.value = { id: 'native-ref' }
    expect(scheduler.job(root)).toBeUndefined()
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
      targetLabel: 'component:scoped-slot-default',
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
      targetLabel: 'component:scoped-slot-default',
      message: expect.stringContaining('component:scoped-slot-default'),
    }))
  })

  it('attributes debug events to manifest bindings from actual payload paths', () => {
    const debug = vi.fn()
    const setData = vi.fn()
    const state = {
      user: { name: 'Ada' },
      count: 1,
      fallbackRoot: { ready: true },
    }
    const bindingManifest: WevuRuntimeBindingManifestV1 = {
      version: 1,
      sourceFile: 'src/pages/home.vue',
      bindings: [
        {
          id: 'binding:user-name',
          outputPath: 'user.name',
          sourceRoots: ['user'],
          sourceLocation: {
            start: { offset: 10, line: 2, column: 5 },
            end: { offset: 19, line: 2, column: 14 },
          },
        },
        {
          id: 'binding:count',
          outputPath: 'count.value',
          sourceRoots: ['count'],
          updateMode: 'top-level',
        },
        {
          id: 'binding:fallback',
          outputPath: '__wv_bind_0',
          sourceRoots: ['fallbackRoot'],
          updateMode: 'snapshot-fallback',
        },
        {
          id: 'binding:unknown',
          outputPath: '*',
          sourceRoots: [],
          updateMode: 'snapshot-fallback',
        },
        {
          id: 'binding:username',
          outputPath: 'username',
          sourceRoots: ['username'],
        },
        {
          id: 'binding:user-name',
          outputPath: 'user',
          sourceRoots: ['user'],
          updateMode: 'top-level',
        },
      ],
    }
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
      debugWhen: 'always',
      debugSampleRate: 1,
      bindingManifest,
      loopWarning: false,
      runTracker: () => {},
      isMounted: () => true,
    })

    scheduler.job({})
    expect(setData).toHaveBeenCalledWith({
      user: { name: 'Ada' },
      count: 1,
      fallbackRoot: { ready: true },
    })

    expect(debug).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'diff',
      bindings: [
        {
          id: 'binding:user-name',
          outputPath: 'user.name',
          updateMode: 'exact-path',
          sourceFile: 'src/pages/home.vue',
          sourceLocation: {
            start: { offset: 10, line: 2, column: 5 },
            end: { offset: 19, line: 2, column: 14 },
          },
        },
        {
          id: 'binding:count',
          outputPath: 'count.value',
          updateMode: 'top-level',
          sourceFile: 'src/pages/home.vue',
        },
        {
          id: 'binding:fallback',
          outputPath: '__wv_bind_0',
          updateMode: 'snapshot-fallback',
          sourceFile: 'src/pages/home.vue',
        },
        {
          id: 'binding:unknown',
          outputPath: '*',
          updateMode: 'snapshot-fallback',
          sourceFile: 'src/pages/home.vue',
        },
      ],
    }))
  })

  it('does not inspect manifest bindings when the debug event is filtered out', () => {
    let bindingReads = 0
    const bindingManifest: WevuRuntimeBindingManifestV1 = {
      version: 1,
      sourceFile: 'src/pages/quiet.vue',
      bindings: [],
    }
    Object.defineProperty(bindingManifest, 'bindings', {
      configurable: true,
      get() {
        bindingReads += 1
        return []
      },
    })
    const debug = vi.fn()
    const scheduler = createSetDataScheduler({
      state: { count: 1 },
      computedRefs: {},
      dirtyComputedKeys: new Set(),
      includeComputed: false,
      functionPaths: [],
      setDataStrategy: 'diff',
      computedCompare: 'reference',
      computedCompareMaxDepth: 2,
      computedCompareMaxKeys: 20,
      currentAdapter: { setData: vi.fn() },
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
      bindingManifest,
      loopWarning: false,
      runTracker: () => {},
      isMounted: () => true,
    })

    scheduler.job({})

    expect(debug).not.toHaveBeenCalled()
    expect(bindingReads).toBe(0)
  })

  it('matches bracket and dot notation on the same binding path', () => {
    const bindingManifest: WevuRuntimeBindingManifestV1 = {
      version: 1,
      sourceFile: 'src/pages/list.vue',
      bindings: [{
        id: 'binding:list-item',
        outputPath: 'list.0.name',
      }],
    }

    expect(resolveBindingDiagnostics(bindingManifest, ['list[0].name'])).toEqual([
      expect.objectContaining({ id: 'binding:list-item' }),
    ])
  })

  it('rejects malformed and unknown binding manifests', () => {
    expect(resolveBindingManifest({ version: 1 })).toBeUndefined()
    expect(resolveBindingManifest({
      version: 2,
      sourceFile: 'src/pages/index.vue',
      bindings: [],
      features: {},
    })).toBeUndefined()
    expect(resolveBindingManifest({
      version: 1,
      sourceFile: 'src/pages/index.vue',
      bindings: [{
        id: 'b0',
        kind: 'text',
        outputPath: 'title',
        sourceRoots: ['title'],
        updateMode: 'exact-path',
        sourceLocation: {
          start: { offset: 0, line: '1', column: 1 },
          end: { offset: 5, line: 1, column: 6 },
        },
      }],
      features: {},
    })).toBeUndefined()
    expect(resolveBindingManifest({
      version: 1,
      sourceFile: 'src/pages/index.vue',
      bindings: [],
      features: { scopedSlots: false },
    })).toBeUndefined()
    expect(resolveBindingManifest({
      version: 1,
      sourceFile: 'src/pages/index.vue',
      bindings: [{
        id: 'b0',
        kind: 'text',
        outputPath: 'title',
        sourceRoots: ['title'],
        updateMode: 'exact-path',
        sourceLocation: {
          start: { offset: Number.NaN, line: 0, column: 1.5 },
          end: { offset: 5, line: 1, column: 6 },
        },
      }],
      features: {},
    })).toBeUndefined()
    expect(resolveBindingManifest({
      version: 1,
      sourceFile: 'src/pages/index.vue',
      bindings: [{
        id: 'b0',
        kind: 'text',
        outputPath: 'title',
        sourceRoots: ['title'],
        updateMode: 'exact-path',
        sourceLocation: {
          start: { offset: 6, line: 1, column: 7 },
          end: { offset: 5, line: 1, column: 6 },
        },
      }],
      features: {},
    })).toBeUndefined()
  })

  for (const strategy of ['diff', 'patch'] as const) {
    for (const failureKind of ['reject', 'throw'] as const) {
      it(`${strategy} sends a full disjoint recovery after adapter ${failureKind}`, async () => {
        const state = reactive({ branch: { a: 0, b: 0, c: 0 } })
        const payloads: SetDataPayload[] = []
        const reportError = vi.fn()
        const debug = vi.fn()
        let shouldFail = true
        const cause = new Error(`${failureKind} boom`)
        const adapter: CommitAwareSetDataAdapter = {
          setData(payload) {
            payloads.push(payload)
            if (!shouldFail) {
              return undefined
            }
            shouldFail = false
            if (failureKind === 'throw') {
              throw cause
            }
            return Promise.reject(cause)
          },
          __wevu_reportSetDataError: reportError,
        }
        const { scheduler, root } = createScheduler({
          state,
          strategy,
          adapter,
          initialSnapshot: { branch: { a: 0, b: 0, c: 0 } },
          debug,
          debugSampleRate: 0,
        })
        scheduler.job(root)
        payloads.length = 0

        state.branch.a = 1
        if (strategy === 'patch') {
          recordPatch(scheduler, root, 'branch.a')
        }
        expect(scheduler.job(root)).toBeUndefined()
        await Promise.resolve()
        await Promise.resolve()

        expect(reportError).toHaveBeenCalledTimes(1)
        expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ cause }))
        expect(debug).toHaveBeenCalledWith(expect.objectContaining({
          reason: 'commitFailure',
          revision: 1,
          committedRevision: 0,
        }))

        state.branch.b = 1
        if (strategy === 'patch') {
          recordPatch(scheduler, root, 'branch.b')
        }
        expect(scheduler.job(root)).toBeUndefined()
        expect(payloads.at(-1)).toEqual({
          branch: { a: 1, b: 1, c: 0 },
        })

        state.branch.c = 1
        if (strategy === 'patch') {
          recordPatch(scheduler, root, 'branch.c')
        }
        scheduler.job(root)
        expect(payloads.at(-1)).toEqual({ 'branch.c': 1 })
      })
    }
  }

  it('returns void while a Promise adapter remains pending', () => {
    const state = reactive({ count: 0 })
    const setData = vi.fn(() => new Promise<void>(() => {}))
    const { scheduler, root } = createScheduler({
      state,
      strategy: 'diff',
      adapter: { setData },
      initialSnapshot: { count: 0 },
    })

    state.count = 1
    expect(scheduler.job(root)).toBeUndefined()
    expect(setData).toHaveBeenCalledWith({ count: 1 })
  })
})
