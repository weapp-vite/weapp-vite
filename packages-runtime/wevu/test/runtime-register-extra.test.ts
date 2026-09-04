import type { SetDataAdapterSettlement, SetDataAdapterSettler } from '@/runtime/app/setData/commitTracker'
import type { InternalRuntimeState, RuntimeApp } from '@/runtime/types'
import {
  WEVU_EXPOSED_KEY,
  WEVU_HOOKS_KEY,
  WEVU_PUBLIC_RUNTIME_KEY,
  WEVU_READY_CALLED_KEY,
  WEVU_TEMPLATE_REFS_KEY,
  WEVU_WATCH_STOPS_KEY,
} from '@weapp-core/constants'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, getCurrentScope, nextTick, onError, onErrorCaptured, onScopeDispose, reactive, ref, setPageLayout, watch, watchEffect } from '@/index'
import { callHookReturn, setCurrentInstance } from '@/runtime/hooks'
import {
  mountRuntimeInstance,
  registerApp,
  registerComponent,
  runSetupFunction,
  teardownRuntimeInstance,
} from '@/runtime/register'
import { enableDeferredSetData } from '@/runtime/register/runtimeInstance'
import { getOwnerSnapshot } from '@/runtime/scopedSlots'

const componentCalls: Record<string, any>[] = []
const appCalls: Record<string, any>[] = []

beforeEach(() => {
  componentCalls.length = 0
  appCalls.length = 0
  ;(globalThis as any).Component = (options: Record<string, any>) => {
    componentCalls.push(options)
  }
  ;(globalThis as any).App = (options: Record<string, any>) => {
    appCalls.push(options)
  }
})

afterEach(() => {
  delete (globalThis as any).Component
  delete (globalThis as any).App
  delete (globalThis as any).wx
  setCurrentInstance(undefined)
})

function createRuntimeAppStub() {
  const runtime = {
    state: {},
    proxy: {},
    methods: {},
    watch: vi.fn(() => vi.fn()),
    bindModel: vi.fn(() => ({ update: vi.fn() })),
    unmount: vi.fn(),
    adapter: undefined as any,
  }
  const app = {
    mount: vi.fn((adapter: any) => {
      runtime.adapter = adapter
      return runtime
    }),
    use: vi.fn(() => app),
    config: { globalProperties: {} },
  } as unknown as RuntimeApp<any, any, any>

  return { app, runtime }
}

describe('runSetupFunction', () => {
  it('returns undefined when setup is absent and injects runtime context', () => {
    const ctx: any = {}
    expect(runSetupFunction(undefined, {}, ctx)).toBeUndefined()

    const setup = (props: any, context: any) => ({ props, context })
    const result = runSetupFunction(setup, { a: 1 }, {}) as any
    expect(result.props).toEqual({ a: 1 })
    expect(result.context.runtime).toBeTruthy()
  })

  it('passes props and context in Vue 3 style', () => {
    const setup = (_props: any, context: any) => ({ ok: Boolean(context.runtime) })
    const result = runSetupFunction(setup, { a: 1 }, {}) as any
    expect(result.ok).toBe(true)
  })

  it('reuses existing runtime context and supports missing outer context', () => {
    const runtime = {
      methods: { greet: vi.fn() },
      state: { count: 1 },
      proxy: { count: 1 },
      watch: vi.fn(() => vi.fn()),
      bindModel: vi.fn(),
    }
    const context: any = {
      attrs: { id: 1 },
      runtime,
    }
    const setup = vi.fn((_props: any, receivedContext: any) => receivedContext)

    const withContext = runSetupFunction(setup, { a: 1 }, context) as any
    expect(withContext.runtime).toBe(runtime)
    expect(context.runtime).toBe(runtime)
    expect(setup).toHaveBeenCalledWith({ a: 1 }, expect.objectContaining({
      attrs: { id: 1 },
      runtime,
    }))

    const withoutContext = runSetupFunction((_props: any, receivedContext: any) => receivedContext, { b: 2 }, undefined) as any
    expect(withoutContext.runtime).toMatchObject({
      methods: {},
      state: {},
      proxy: {},
    })
    expect(typeof withoutContext.runtime.watch).toBe('function')
    expect(typeof withoutContext.runtime.bindModel).toBe('function')
  })
})

describe('mountRuntimeInstance and teardown', () => {
  it('supports deferred setData and watch maps', () => {
    const { app, runtime } = createRuntimeAppStub()
    const target: any = { properties: { foo: 1 }, setData: vi.fn() }

    const watchMap = {
      'foo.bar': 'onFoo',
      '': (value: any) => value,
      'invalid': 123,
    } as any

    runtime.methods = { onFoo: vi.fn() }

    mountRuntimeInstance(target, app as any, watchMap, undefined, { deferSetData: true })

    expect(target.__wevu).toBeTruthy()
    expect(typeof target[WEVU_PUBLIC_RUNTIME_KEY]).toBe('object')

    target.__wevu.adapter.setData({ a: 1 })
    target.__wevu.adapter.__wevu_enableSetData()
    expect(target.setData).toHaveBeenCalledWith({ a: 1 }, expect.any(Function))

    teardownRuntimeInstance(target)
  })

  it('refreshes conditional component refs after the native setData callback', async () => {
    const { app } = createRuntimeAppStub()
    let nativeCallback: (() => void) | undefined
    const open = vi.fn()
    const target: any = {
      [WEVU_READY_CALLED_KEY]: true,
      [WEVU_TEMPLATE_REFS_KEY]: [
        { selector: '.conditional', inFor: false, name: 'conditional', kind: 'component' },
      ],
      selectComponent: vi.fn(() => null),
      setData: vi.fn((_payload, callback) => {
        nativeCallback = callback
      }),
    }

    mountRuntimeInstance(target, app as any, undefined, undefined)
    target.__wevu.adapter.setData({ visible: true })
    await nextTick()
    await nextTick()

    expect(target.__wevu.state.$refs?.conditional).toBeUndefined()
    target.selectComponent.mockReturnValue({ open })
    nativeCallback?.()
    await nextTick()
    await nextTick()

    expect(target.__wevu.state.$refs.conditional.open).toBeTypeOf('function')
    target.__wevu.state.$refs.conditional.open()
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('resolves nextTick after native dispatch and refreshes refs only after commit', async () => {
    const app = createApp({
      data: () => ({ visible: false }),
    })
    let nativeCallback: (() => void) | undefined
    let rendered = false
    const conditional = { open: vi.fn() }
    const target: any = {
      [WEVU_READY_CALLED_KEY]: true,
      [WEVU_TEMPLATE_REFS_KEY]: [
        { selector: '.conditional', inFor: false, name: 'conditional', kind: 'component' },
      ],
      data: { visible: false },
      selectComponent: vi.fn(() => rendered ? conditional : null),
      setData: vi.fn((payload, callback) => {
        Object.assign(target.data, payload)
        nativeCallback = callback
      }),
    }

    mountRuntimeInstance(target, app as any, undefined, undefined)
    target.__wevu.proxy.visible = true
    let settled = false
    await nextTick().then(() => {
      settled = true
    })

    expect(settled).toBe(true)
    expect(nativeCallback).toBeTypeOf('function')
    expect(target.__wevu.state.$refs?.conditional).toBeUndefined()
    rendered = true
    nativeCallback?.()
    await nextTick()
    await nextTick()

    expect(target.__wevu.state.$refs.conditional.open).toBeTypeOf('function')
    target.__wevu.state.$refs.conditional.open()
    expect(conditional.open).toHaveBeenCalledTimes(1)
  })

  it('buffers setData while hidden when suspendWhenHidden is enabled', () => {
    const { app } = createRuntimeAppStub()
    ;(app as any).__wevuSetDataOptions = { suspendWhenHidden: true }
    const target: any = { setData: vi.fn() }

    mountRuntimeInstance(target, app as any, undefined, undefined)

    const adapter = target.__wevu.adapter as any
    adapter.__wevu_setVisibility(false)
    adapter.setData({ a: 1 })
    adapter.setData({ b: 2, a: 3 })
    expect(target.setData).not.toHaveBeenCalled()

    adapter.__wevu_setVisibility(true)
    expect(target.setData).toHaveBeenCalledTimes(1)
    expect(target.setData).toHaveBeenCalledWith({ a: 3, b: 2 }, expect.any(Function))

    teardownRuntimeInstance(target)
  })

  it('callback-gates native commits without refs and recovers from overtaken callbacks', async () => {
    const app = createApp({
      data: () => ({ branch: { a: 0, b: 0, c: 0 } }),
    })
    const nativeCallbacks: Array<() => void> = []
    const target = {
      data: { branch: { a: 0, b: 0, c: 0 } },
      setData: vi.fn((_payload: Record<string, unknown>, callback: () => void) => {
        nativeCallbacks.push(callback)
      }),
    } satisfies InternalRuntimeState

    const runtime = mountRuntimeInstance(target, app, undefined, undefined)
    runtime.state.branch.a = 1
    await nextTick()
    runtime.state.branch.b = 1
    await nextTick()

    expect(nativeCallbacks).toHaveLength(2)
    expect(target.setData).toHaveBeenNthCalledWith(1, { 'branch.a': 1 }, expect.any(Function))
    expect(target.setData).toHaveBeenNthCalledWith(2, { 'branch.b': 1 }, expect.any(Function))
    nativeCallbacks[1]!()
    nativeCallbacks[0]!()

    runtime.state.branch.c = 1
    await nextTick()
    expect(target.setData).toHaveBeenLastCalledWith(expect.objectContaining({
      branch: { a: 1, b: 1, c: 1 },
    }), expect.any(Function))
    teardownRuntimeInstance(target)
  })

  it('prefers Web-shaped thenable rejection and reports it to both error hooks exactly once', async () => {
    const cause = new Error('updateComplete rejected')
    const errors: unknown[] = []
    const capturedErrors: unknown[] = []
    const debug = vi.fn()
    const app = createApp({
      data: () => ({ count: 0 }),
      setData: {
        debug,
        debugWhen: 'always',
      },
    })
    const target = {
      data: { count: 0 },
      setData: vi.fn((
        _payload: Record<string, unknown>,
        _callback?: () => void,
      ) => Promise.reject(cause)),
    } satisfies InternalRuntimeState

    const runtime = mountRuntimeInstance(target, app, undefined, () => {
      onError(error => errors.push(error))
      onErrorCaptured(error => capturedErrors.push(error))
      return {}
    })
    runtime.state.count = 1

    await expect(nextTick()).resolves.toBeUndefined()
    await Promise.resolve()
    await Promise.resolve()

    expect(errors).toHaveLength(1)
    expect(errors[0]).toBeInstanceOf(Error)
    expect((errors[0] as Error & { cause?: unknown }).cause).toBe(cause)
    expect(capturedErrors).toHaveLength(1)
    expect(capturedErrors[0]).toBe(errors[0])
    expect(debug).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'commitFailure',
      revision: 1,
      committedRevision: 0,
    }))
    teardownRuntimeInstance(target)
  })

  it('settles hidden revisions in order after one physical callback', () => {
    const { app } = createRuntimeAppStub()
    Object.defineProperty(app, '__wevuSetDataOptions', { value: { suspendWhenHidden: true } })
    let nativeCallback: (() => void) | undefined
    const target = {
      setData: vi.fn((_payload: Record<string, unknown>, callback: () => void) => {
        nativeCallback = callback
      }),
    } satisfies InternalRuntimeState
    const runtime = mountRuntimeInstance(target, app, undefined, undefined)
    const adapter = runtime.adapter as {
      __wevu_dispatchSetData: (payload: Record<string, unknown>, settle: SetDataAdapterSettler) => void
      __wevu_setVisibility: (visible: boolean) => void
    }
    const settlements: Array<[number, SetDataAdapterSettlement]> = []
    adapter.__wevu_setVisibility(false)
    adapter.__wevu_dispatchSetData({ a: 1 }, settlement => settlements.push([1, settlement]))
    adapter.__wevu_dispatchSetData({ b: 2 }, settlement => settlements.push([2, settlement]))

    expect(target.setData).not.toHaveBeenCalled()
    adapter.__wevu_setVisibility(true)
    expect(target.setData).toHaveBeenCalledWith({ a: 1, b: 2 }, expect.any(Function))
    expect(settlements).toEqual([])

    nativeCallback?.()
    expect(settlements).toEqual([
      [1, 'committed'],
      [2, 'committed'],
    ])
    teardownRuntimeInstance(target)
  })

  it('settles hidden tracked revisions when a buffered raw callback throws', () => {
    const { app } = createRuntimeAppStub()
    Object.defineProperty(app, '__wevuSetDataOptions', { value: { suspendWhenHidden: true } })
    let nativeCallback: (() => void) | undefined
    const target = {
      setData: vi.fn((_payload: Record<string, unknown>, callback: () => void) => {
        nativeCallback = callback
      }),
    } satisfies InternalRuntimeState
    const runtime = mountRuntimeInstance(target, app, undefined, undefined)
    const adapter = runtime.adapter as {
      setData: (payload: Record<string, unknown>, callback?: () => void) => void
      __wevu_dispatchSetData: (payload: Record<string, unknown>, settle: SetDataAdapterSettler) => void
      __wevu_setVisibility: (visible: boolean) => void
    }
    const settlement = vi.fn()
    const callbackError = new Error('buffered callback failed')
    adapter.__wevu_setVisibility(false)
    adapter.setData({ raw: 1 }, () => {
      throw callbackError
    })
    adapter.__wevu_dispatchSetData({ tracked: 1 }, settlement)

    adapter.__wevu_setVisibility(true)
    expect(() => nativeCallback?.()).toThrow(callbackError)
    expect(settlement).toHaveBeenCalledWith('committed', undefined)
    teardownRuntimeInstance(target)
  })

  it('coalesces hidden parent and child paths in chronological order', () => {
    const { app } = createRuntimeAppStub()
    Object.defineProperty(app, '__wevuSetDataOptions', { value: { suspendWhenHidden: true } })
    let nativeCallback: (() => void) | undefined
    const target = {
      setData: vi.fn((_payload: Record<string, unknown>, callback: () => void) => {
        nativeCallback = callback
      }),
    } satisfies InternalRuntimeState
    const runtime = mountRuntimeInstance(target, app, undefined, undefined)
    const adapter = runtime.adapter as {
      __wevu_dispatchSetData: (payload: Record<string, unknown>, settle: SetDataAdapterSettler) => void
      __wevu_setVisibility: (visible: boolean) => void
    }
    const settlements = [vi.fn(), vi.fn(), vi.fn()]
    adapter.__wevu_setVisibility(false)
    adapter.__wevu_dispatchSetData({ branch: { value: 1 } }, settlements[0]!)
    adapter.__wevu_dispatchSetData({ 'branch.value': 2 }, settlements[1]!)
    adapter.__wevu_dispatchSetData({ branch: { value: 3 } }, settlements[2]!)

    adapter.__wevu_setVisibility(true)
    expect(target.setData).toHaveBeenCalledWith({ branch: { value: 3 } }, expect.any(Function))
    nativeCallback?.()
    for (const settle of settlements) {
      expect(settle).toHaveBeenCalledWith('committed', undefined)
    }
    teardownRuntimeInstance(target)
  })

  it('fails one hidden physical commit and abandons the remaining revisions', async () => {
    const { app } = createRuntimeAppStub()
    Object.defineProperty(app, '__wevuSetDataOptions', { value: { suspendWhenHidden: true } })
    const cause = new Error('hidden commit rejected')
    const target = {
      setData: vi.fn(() => Promise.reject(cause)),
    } satisfies InternalRuntimeState
    const runtime = mountRuntimeInstance(target, app, undefined, undefined)
    const adapter = runtime.adapter as {
      __wevu_dispatchSetData: (payload: Record<string, unknown>, settle: SetDataAdapterSettler) => void
      __wevu_setVisibility: (visible: boolean) => void
    }
    const settlements: Array<[number, SetDataAdapterSettlement, unknown?]> = []
    adapter.__wevu_setVisibility(false)
    adapter.__wevu_dispatchSetData({ a: 1 }, (settlement, error) => settlements.push([1, settlement, error]))
    adapter.__wevu_dispatchSetData({ b: 2 }, (settlement, error) => settlements.push([2, settlement, error]))
    adapter.__wevu_setVisibility(true)
    await Promise.resolve()
    await Promise.resolve()

    expect(settlements).toEqual([
      [1, 'failed', cause],
      [2, 'abandoned', undefined],
    ])
    teardownRuntimeInstance(target)
  })

  it('abandons deferred revisions on discard and flushes retained revisions together', () => {
    const { app } = createRuntimeAppStub()
    const discardedTarget = { setData: vi.fn() } satisfies InternalRuntimeState
    const discardedRuntime = mountRuntimeInstance(discardedTarget, app, undefined, undefined, { deferSetData: true })
    const discardedAdapter = discardedRuntime.adapter as {
      __wevu_dispatchSetData: (payload: Record<string, unknown>, settle: SetDataAdapterSettler) => void
      __wevu_enableSetData: (discard?: boolean) => void
    }
    const discarded = vi.fn()
    discardedAdapter.__wevu_dispatchSetData({ stale: 1 }, discarded)
    discardedAdapter.__wevu_enableSetData(true)
    expect(discarded).toHaveBeenCalledWith('abandoned', undefined)
    expect(discardedTarget.setData).not.toHaveBeenCalled()
    teardownRuntimeInstance(discardedTarget)

    const { app: retainedApp } = createRuntimeAppStub()
    let nativeCallback: (() => void) | undefined
    const retainedTarget = {
      setData: vi.fn((_payload: Record<string, unknown>, callback: () => void) => {
        nativeCallback = callback
      }),
    } satisfies InternalRuntimeState
    const retainedRuntime = mountRuntimeInstance(retainedTarget, retainedApp, undefined, undefined, { deferSetData: true })
    const retainedAdapter = retainedRuntime.adapter as {
      __wevu_dispatchSetData: (payload: Record<string, unknown>, settle: SetDataAdapterSettler) => void
      __wevu_enableSetData: (discard?: boolean) => void
    }
    const first = vi.fn()
    const second = vi.fn()
    retainedAdapter.__wevu_dispatchSetData({ a: 1 }, first)
    retainedAdapter.__wevu_dispatchSetData({ b: 2 }, second)
    retainedAdapter.__wevu_enableSetData()
    expect(retainedTarget.setData).toHaveBeenCalledTimes(1)
    expect(retainedTarget.setData).toHaveBeenCalledWith({ a: 1, b: 2 }, expect.any(Function))
    nativeCallback?.()
    expect(first).toHaveBeenCalledWith('committed', undefined)
    expect(second).toHaveBeenCalledWith('committed', undefined)
    teardownRuntimeInstance(retainedTarget)
  })

  it('coalesces deferred child and parent paths in chronological order', () => {
    const { app } = createRuntimeAppStub()
    let nativeCallback: (() => void) | undefined
    const target = {
      setData: vi.fn((_payload: Record<string, unknown>, callback: () => void) => {
        nativeCallback = callback
      }),
    } satisfies InternalRuntimeState
    const runtime = mountRuntimeInstance(target, app, undefined, undefined, { deferSetData: true })
    const adapter = runtime.adapter as {
      __wevu_dispatchSetData: (payload: Record<string, unknown>, settle: SetDataAdapterSettler) => void
      __wevu_enableSetData: (discard?: boolean) => void
    }
    const settlements = [vi.fn(), vi.fn(), vi.fn()]
    adapter.__wevu_dispatchSetData({ 'branch.value': 1 }, settlements[0]!)
    adapter.__wevu_dispatchSetData({ branch: { value: 2 } }, settlements[1]!)
    adapter.__wevu_dispatchSetData({ 'branch.value': 3 }, settlements[2]!)

    adapter.__wevu_enableSetData()
    expect(target.setData).toHaveBeenCalledWith({ branch: { value: 3 } }, expect.any(Function))
    nativeCallback?.()
    for (const settle of settlements) {
      expect(settle).toHaveBeenCalledWith('committed', undefined)
    }
    teardownRuntimeInstance(target)
  })

  it('turns deferred discard into a full scheduler recovery payload', () => {
    const app = createApp({
      data: () => ({ count: 0, stable: 'keep' }),
    })
    const target = {
      data: { count: 0, stable: 'keep' },
      setData: vi.fn(),
    } satisfies InternalRuntimeState
    const runtime = mountRuntimeInstance(target, app, undefined, undefined, { deferSetData: true })
    runtime.state.count = 1
    ;(runtime as typeof runtime & { __wevu_flushSetupSnapshotSync?: () => void }).__wevu_flushSetupSnapshotSync?.()
    expect(target.setData).not.toHaveBeenCalled()

    enableDeferredSetData(target)
    expect(target.setData).toHaveBeenCalledWith(expect.objectContaining({
      count: 1,
      stable: 'keep',
    }), expect.any(Function))
    teardownRuntimeInstance(target)
  })

  it('disposes buffered host work and rejects new tracked dispatches as abandoned', () => {
    const app = createApp({
      data: () => ({ count: 0 }),
      setData: {
        suspendWhenHidden: true,
      },
    })
    const target = {
      data: { count: 0 },
      setData: vi.fn(),
    } satisfies InternalRuntimeState
    const runtime = mountRuntimeInstance(target, app, undefined, undefined)
    const adapter = runtime.adapter as {
      __wevu_dispatchSetData: (payload: Record<string, unknown>, settle: SetDataAdapterSettler) => void
      __wevu_setVisibility: (visible: boolean) => void
    }
    const buffered = vi.fn()
    adapter.__wevu_setVisibility(false)
    adapter.__wevu_dispatchSetData({ count: 1 }, buffered)

    teardownRuntimeInstance(target)
    expect(target.setData).not.toHaveBeenCalled()
    expect(buffered).not.toHaveBeenCalled()

    const afterDispose = vi.fn()
    adapter.__wevu_dispatchSetData({ count: 2 }, afterDispose)
    expect(afterDispose).toHaveBeenCalledWith('abandoned')
    expect(target.setData).not.toHaveBeenCalled()
  })

  it('bridges methods to instance and handles teardown errors', () => {
    const { app, runtime } = createRuntimeAppStub()
    runtime.methods = {
      greet: () => 'hi',
    }
    runtime.proxy = { name: 'x' }

    const target: any = { setData: vi.fn() }
    mountRuntimeInstance(target, app as any, undefined, undefined)

    expect(typeof target.greet).toBe('function')
    expect(target.greet()).toBe('hi')

    target[WEVU_HOOKS_KEY] = { onUnload: [vi.fn()] }
    target[WEVU_WATCH_STOPS_KEY] = [
      () => {
        throw new Error('stop error')
      },
    ]

    teardownRuntimeInstance(target)
    expect(runtime.unmount).toHaveBeenCalled()
  })

  it('finishes runtime teardown before rethrowing a scope cleanup failure', () => {
    const app = createApp({})
    const target: InternalRuntimeState = {
      route: 'pages/scope-error/index',
      setData: vi.fn(),
    }
    const cleanupAfterFailure = vi.fn()
    const failure = new Error('scope cleanup failed')

    mountRuntimeInstance(target, app, undefined, () => {
      onScopeDispose(() => {
        throw failure
      })
      onScopeDispose(cleanupAfterFailure)
      return {}
    })
    const runtime = target.__wevu
    if (!runtime) {
      throw new Error('Expected runtime instance to be mounted')
    }
    const unmountFailure = new Error('runtime unmount failed')
    const unmount = vi.spyOn(runtime, 'unmount').mockImplementation(() => {
      throw unmountFailure
    })

    expect(() => teardownRuntimeInstance(target)).toThrow(failure)
    expect(cleanupAfterFailure).toHaveBeenCalledTimes(1)
    expect(unmount).toHaveBeenCalledTimes(1)
    expect(target.__wevu).toBeUndefined()
    expect(target[WEVU_PUBLIC_RUNTIME_KEY]).toBeUndefined()
  })

  it('clears runtime fields before rethrowing an unmount failure', () => {
    const { app, runtime } = createRuntimeAppStub()
    const target: InternalRuntimeState = {
      setData: vi.fn(),
    }
    const failure = new Error('runtime unmount failed')
    runtime.unmount.mockImplementation(() => {
      throw failure
    })

    mountRuntimeInstance(target, app, undefined, undefined)

    expect(() => teardownRuntimeInstance(target)).toThrow(failure)
    expect(target.__wevu).toBeUndefined()
    expect(target[WEVU_PUBLIC_RUNTIME_KEY]).toBeUndefined()
  })

  it('handles frozen runtime objects', () => {
    const runtime = Object.freeze({ state: {}, proxy: {}, unmount: vi.fn() }) as any
    const app = {
      mount: vi.fn(() => runtime),
      use: vi.fn(),
      config: { globalProperties: {} },
    } as unknown as RuntimeApp<any, any, any>

    const target: any = {}
    mountRuntimeInstance(target, app, undefined, undefined)
    expect(target.__wevu).toBeTruthy()

    teardownRuntimeInstance(target)
  })

  it('flushes setup refs into the first setData payload synchronously', async () => {
    const app = createApp({})
    const target: any = {
      route: 'pages/issue-328/index',
      setData: vi.fn(),
    }

    mountRuntimeInstance(target, app as any, undefined, () => {
      const value1 = ref('111')
      return { value1 }
    })

    expect(target.setData).toHaveBeenCalledTimes(1)
    expect(target.setData).toHaveBeenCalledWith(expect.objectContaining({ value1: '111' }), expect.any(Function))

    await nextTick()

    expect(target.setData).toHaveBeenCalledTimes(1)
    expect(target[WEVU_PUBLIC_RUNTIME_KEY].state.value1.value).toBe('111')

    teardownRuntimeInstance(target)
  })

  it('refreshes owner snapshot after setup methods are injected', () => {
    const app = createApp({})
    const target: any = {
      route: 'pages/issue-558/index',
      setData: vi.fn(),
    }

    mountRuntimeInstance(target, app as any, undefined, () => {
      const text = '123456789'
      const func = (value = '') => value.split('').reverse().join('')
      return {
        func,
        text,
      }
    })

    const ownerSnapshot = getOwnerSnapshot(target.__wvOwnerId)
    expect(ownerSnapshot?.text).toBe('123456789')
    expect(typeof target[WEVU_PUBLIC_RUNTIME_KEY].proxy.func).toBe('function')
    expect(target[WEVU_PUBLIC_RUNTIME_KEY].proxy.func(ownerSnapshot?.text)).toBe('987654321')

    teardownRuntimeInstance(target)
  })

  it('avoids full owner snapshot collection after patch updates', async () => {
    let getterCalls = 0
    const big = {}
    Object.defineProperty(big, 'hidden', {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1
        return 1
      },
    })
    const shared = { x: 1 }
    const app = createApp({
      data: () => ({ a: shared, b: shared, big }),
      setData: { strategy: 'patch', includeComputed: false },
    })
    const target: any = {
      route: 'pages/owner-snapshot/index',
      setData: vi.fn(),
    }

    mountRuntimeInstance(target, app as any, undefined, undefined)
    getterCalls = 0

    target[WEVU_PUBLIC_RUNTIME_KEY].state.a.x = 2
    await nextTick()

    expect(getterCalls).toBe(0)
    expect(getOwnerSnapshot(target.__wvOwnerId)).toMatchObject({
      a: { x: 2 },
      b: { x: 2 },
    })

    teardownRuntimeInstance(target)
  })

  it('avoids full diff snapshot collection for unchanged top-level keys', async () => {
    let getterCalls = 0
    const big = {}
    Object.defineProperty(big, 'hidden', {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1
        return 1
      },
    })
    const app = createApp({
      data: () => ({
        nested: { count: 1 },
        big,
      }),
    })
    const target: any = {
      route: 'pages/diff-snapshot/index',
      setData: vi.fn(),
    }

    mountRuntimeInstance(target, app as any, undefined, undefined)
    getterCalls = 0
    target.setData.mockClear()

    target[WEVU_PUBLIC_RUNTIME_KEY].state.nested.count = 2
    await nextTick()

    expect(getterCalls).toBe(0)
    expect(target.setData).toHaveBeenCalledWith(expect.objectContaining({ 'nested.count': 2 }), expect.any(Function))

    teardownRuntimeInstance(target)
  })

  it('avoids scanning unrelated state keys when setup refs update', async () => {
    let getterCalls = 0
    const big = {}
    Object.defineProperty(big, 'hidden', {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1
        return 1
      },
    })
    const app = createApp({
      data: () => ({ big }),
    })
    const target: any = {
      route: 'pages/setup-ref-tracking/index',
      setData: vi.fn(),
    }

    mountRuntimeInstance(target, app as any, undefined, () => {
      const active = ref(true)
      return { active }
    })
    getterCalls = 0
    target.setData.mockClear()

    target[WEVU_PUBLIC_RUNTIME_KEY].state.active.value = false
    await nextTick()

    expect(getterCalls).toBe(0)
    expect(target.setData).toHaveBeenCalledWith(expect.objectContaining({ active: false }), expect.any(Function))

    teardownRuntimeInstance(target)
  })

  it('keeps setup reactive array updates when another setup ref inside the same object flushes first', async () => {
    const app = createApp({})
    const target: any = {
      route: 'pages/issue-581/index',
      setData: vi.fn(),
    }
    const queryData = ref<{ name: string }[] | undefined>()
    const isLoading = ref(true)

    mountRuntimeInstance(target, app as any, undefined, () => {
      const state = reactive([{ name: 'init' }])

      watch(queryData, (newData) => {
        state.push(...newData || [])
      })

      const back = {
        state,
        loading: isLoading,
      }

      return {
        back,
      }
    })

    target.setData.mockClear()
    isLoading.value = false
    queryData.value = [{ name: '123' }, { name: '456' }]
    await nextTick()

    expect(target.setData).toHaveBeenCalledWith(expect.objectContaining({
      'back.loading': false,
    }), expect.any(Function))

    await nextTick()

    expect(target.setData).toHaveBeenCalledWith(expect.objectContaining({
      'back.state': [{ name: 'init' }, { name: '123' }, { name: '456' }],
    }), expect.any(Function))

    teardownRuntimeInstance(target)
  })

  it('creates a setup effect scope and disposes scoped effects on teardown', async () => {
    const app = createApp({})
    const target: any = {
      route: 'pages/scope/index',
      setData: vi.fn(),
    }
    const source = ref(0)
    const cleanup = vi.fn()
    const calls: number[] = []

    mountRuntimeInstance(target, app as any, undefined, () => {
      expect(getCurrentScope()).toBeTruthy()
      onScopeDispose(cleanup)
      watchEffect(() => {
        calls.push(source.value)
      })
      return {}
    })

    await nextTick()
    expect(calls).toEqual([0])

    source.value = 1
    await nextTick()
    expect(calls).toEqual([0, 1])

    teardownRuntimeInstance(target)
    expect(cleanup).toHaveBeenCalledTimes(1)

    source.value = 2
    await nextTick()
    expect(calls).toEqual([0, 1])
  })

  it('supports calling setPageLayout in immediate watch callbacks during setup', async () => {
    const app = createApp({})
    const target: any = {
      route: 'pages/layout-watch/index',
      setData: vi.fn(),
    }

    expect(() => {
      mountRuntimeInstance(target, app as any, undefined, () => {
        const layoutName = ref<'default' | 'admin'>('default')

        watch(layoutName, (value) => {
          setPageLayout(value, value === 'admin' ? { title: 'Watch Admin' } : {})
        }, { immediate: true })

        return {
          layoutName,
        }
      })
    }).not.toThrow()

    expect(target.__wevu?.state.__wv_page_layout_name).toBe('default')

    target[WEVU_PUBLIC_RUNTIME_KEY].state.layoutName.value = 'admin'
    await nextTick()
    expect(target.__wevu?.state.__wv_page_layout_name).toBe('admin')
    expect(target.__wevu?.state.__wv_page_layout_props).toEqual({
      title: 'Watch Admin',
    })

    teardownRuntimeInstance(target)
  })
})

describe('registerApp', () => {
  it('throws when App constructor missing', () => {
    delete (globalThis as any).App
    const { app } = createRuntimeAppStub()
    expect(() => registerApp(app, {}, undefined, undefined, {} as any)).toThrow('createApp 需要全局 App 构造器可用')
  })

  it('wraps lifecycle hooks and methods', () => {
    const { app } = createRuntimeAppStub()
    const userOnLaunch = vi.fn()
    const userOnShow = vi.fn()
    const userOnHide = vi.fn()
    const userOnError = vi.fn()
    const userMethod = vi.fn(() => 'user')
    let errorListener: ((...args: any[]) => void) | undefined
    ;(globalThis as any).wx = {
      onError: vi.fn((fn: (...args: any[]) => void) => {
        errorListener = fn
      }),
      offError: vi.fn(),
    }

    registerApp(app, { ping: vi.fn(() => 'pong') }, undefined, undefined, {
      onLaunch: userOnLaunch,
      onShow: userOnShow,
      onHide: userOnHide,
      onError: userOnError,
      ping: userMethod,
    } as any)

    const options = appCalls.pop()!
    const instance: any = { setData: vi.fn() }

    options.onLaunch.call(instance)
    options.onShow.call(instance)
    options.onHide.call(instance)
    errorListener?.()

    expect(userOnLaunch).toHaveBeenCalled()
    expect(userOnShow).toHaveBeenCalled()
    expect(userOnHide).toHaveBeenCalled()
    expect(userOnError).toHaveBeenCalled()
    expect(options.onError).toBeUndefined()

    instance.__wevu = { methods: { ping: () => 'pong' }, proxy: {} }
    expect(options.ping.call(instance)).toBe('user')

    const inlineResult = options.__weapp_vite_inline.call(instance, { currentTarget: { dataset: {} } })
    expect(inlineResult).toBeUndefined()
  })
})

describe('registerComponent', () => {
  it('registers component with features, observers, and model handler', () => {
    const { app } = createRuntimeAppStub()
    const onPullDownRefresh = vi.fn()
    const onShareAppMessage = vi.fn(() => ({ title: 'x' }))

    registerComponent(app, { onFoo: () => 'foo' }, undefined, undefined, {
      properties: {
        foo: String,
      },
      observers: {
        foo: vi.fn(),
      },
      methods: {
        onFoo: vi.fn(),
      },
      features: {
        enableOnPullDownRefresh: true,
        enableOnShareAppMessage: true,
      },
      onPullDownRefresh,
      onShareAppMessage,
      export() {
        return { from: 'user' }
      },
    } as any)

    const options = componentCalls.pop()!
    expect(options.options.multipleSlots).toBe(true)

    const instance: any = {
      properties: { foo: 1 },
      setData: vi.fn(),
      triggerEvent: vi.fn(),
      [WEVU_HOOKS_KEY]: {
        onShareAppMessage: () => ({ title: 'hook' }),
      },
    }

    options.lifetimes.created.call(instance)
    options.lifetimes.attached.call(instance)
    options.pageLifetimes.show.call(instance)

    const exportValue = options.export.call({ [WEVU_EXPOSED_KEY]: { bar: 1 } })
    expect(exportValue).toEqual({ bar: 1, from: 'user' })

    const shareResult = options.onShareAppMessage.call(instance)
    expect(shareResult).toEqual({ title: 'hook' })

    options.onPullDownRefresh.call(instance)
    expect(onPullDownRefresh).toHaveBeenCalled()

    const modelMissing = options.methods.__weapp_vite_model.call(instance, { currentTarget: { dataset: {} } })
    expect(modelMissing).toBeUndefined()

    instance.__wevu = { bindModel: () => ({ update: vi.fn(() => {
      throw new Error('fail')
    }) }) }
    options.methods.__weapp_vite_model.call(instance, { currentTarget: { dataset: { wvModel: 'foo' } } })

    const obs = options.observers.foo
    const propsProxy = { foo: 0 }
    instance.__wevuProps = propsProxy
    obs.call(instance, 2)
    expect(propsProxy.foo).toBe(2)
  })

  it('honors lifecycle defaults and export fallbacks', () => {
    const { app } = createRuntimeAppStub()
    const legacyCreated = vi.fn()

    registerComponent(app, {}, undefined, undefined, {
      created: legacyCreated,
      options: { multipleSlots: false },
      export() {
        return 'invalid' as any
      },
      features: { enableOnSaveExitState: true },
    } as any)

    const options = componentCalls.pop()!
    expect(options.options.multipleSlots).toBe(false)

    const instance: any = { setData: vi.fn() }
    options.lifetimes.created.call(instance)
    options.lifetimes.ready.call(instance)
    options.lifetimes.detached.call(instance)

    const exported = options.export.call({ [WEVU_EXPOSED_KEY]: { ok: true } })
    expect(exported).toBe('invalid')

    const save = options.onSaveExitState.call({ [WEVU_HOOKS_KEY]: {} })
    expect(save).toEqual({ data: undefined })
  })

  it('covers callHookReturn with fallback', () => {
    const { app } = createRuntimeAppStub()

    registerComponent(app, {}, undefined, undefined, {
      features: { enableOnShareTimeline: true },
      onShareTimeline() {
        return { title: 'user' }
      },
    } as any)

    const options = componentCalls.pop()!
    expect(options.onShareAppMessage).toBeUndefined()

    const instance: any = { [WEVU_HOOKS_KEY]: {}, setData: vi.fn() }
    const result = options.onShareTimeline.call(instance)
    expect(result).toEqual({ title: 'user' })

    instance[WEVU_HOOKS_KEY] = { onShareTimeline: () => ({ title: 'hook' }) }
    expect(callHookReturn(instance, 'onShareTimeline', [])).toEqual({ title: 'hook' })
  })
})

describe('createApp integration coverage', () => {
  it('registers App when global App exists', () => {
    createApp({ data: () => ({ count: 1 }) })
    const options = appCalls.pop()
    expect(options).toBeTruthy()
  })
})
