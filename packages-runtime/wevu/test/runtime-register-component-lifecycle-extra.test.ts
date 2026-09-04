import {
  WEVU_ON_LOAD_CALLED_KEY,
  WEVU_READY_CALLED_KEY,
  WEVU_ROUTE_DONE_CALLED_KEY,
} from '@weapp-core/constants'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { registerRuntimeCapability } from '@/runtime/capabilities'
import { createPageLifecycleHooks } from '@/runtime/register/component/lifecycle'

const mocks = vi.hoisted(() => {
  return {
    callHookList: vi.fn(),
    scheduleTemplateRefUpdate: vi.fn((_target: any, task: () => void) => task()),
    mountRuntimeInstance: vi.fn(),
    enableDeferredSetData: vi.fn(),
    setRuntimeSetDataVisibility: vi.fn(),
    teardownRuntimeInstance: vi.fn(),
    attachOptionalPageLifecycleHooks: vi.fn((hooks: Record<string, any>, _options?: any) => hooks),
    bindCurrentPageInstance: vi.fn(),
    ensurePageShareMenus: vi.fn(),
    ensureMiniProgramGlobalPatched: vi.fn(),
    releaseCurrentPageInstance: vi.fn(),
    resolvePageOptions: vi.fn(() => ({ from: 'resolved-options' })),
    notifyRouteStateSync: vi.fn(),
    getInitialNavigationRunner: vi.fn(),
    ensureInitialNavigation: vi.fn(),
    cancelInitialNavigation: vi.fn(),
    getInitialNavigationPromise: vi.fn(),
    initialNavigationControllers: new WeakMap<object, { promise: Promise<boolean>, start: (query?: unknown) => void, callbacks: Set<(shouldMount: boolean) => void> }>(),
  }
})

vi.mock('@/router/routeSync', () => ({
  notifyRouteStateSync: mocks.notifyRouteStateSync,
}))

vi.mock('@/router/initialNavigation', () => ({
  getInitialNavigationRunner: mocks.getInitialNavigationRunner,
  ensureInitialNavigation: mocks.ensureInitialNavigation,
  cancelInitialNavigation: mocks.cancelInitialNavigation,
  getInitialNavigationPromise: mocks.getInitialNavigationPromise,
}))

vi.mock('@/runtime/hooks', () => ({
  callHookList: mocks.callHookList,
}))

vi.mock('@/runtime/register/runtimeInstance', () => ({
  mountRuntimeInstance: mocks.mountRuntimeInstance,
  enableDeferredSetData: mocks.enableDeferredSetData,
  setRuntimeSetDataVisibility: mocks.setRuntimeSetDataVisibility,
  teardownRuntimeInstance: mocks.teardownRuntimeInstance,
}))

vi.mock('@/runtime/register/component/lifecycle/optionalHooks', () => ({
  attachOptionalPageLifecycleHooks: mocks.attachOptionalPageLifecycleHooks,
}))

vi.mock('@/runtime/register/component/lifecycle/platform', () => ({
  bindCurrentPageInstance: mocks.bindCurrentPageInstance,
  ensurePageShareMenus: mocks.ensurePageShareMenus,
  ensureMiniProgramGlobalPatched: mocks.ensureMiniProgramGlobalPatched,
  releaseCurrentPageInstance: mocks.releaseCurrentPageInstance,
  resolvePageOptions: mocks.resolvePageOptions,
}))

describe('runtime: component page lifecycle extra', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.initialNavigationControllers = new WeakMap()
    for (const mock of Object.values(mocks)) {
      ;(mock as any).mockReset?.()
    }
    mocks.scheduleTemplateRefUpdate.mockImplementation((_target: any, task: () => void) => task())
    registerRuntimeCapability('templateRefs', {
      attachBindings() {},
      hasBindings(target) {
        return Array.isArray(target.__wevuTemplateRefs) && target.__wevuTemplateRefs.length > 0
      },
      schedule(target, onResolved) {
        mocks.scheduleTemplateRefUpdate(target, onResolved ?? (() => {}))
      },
      scheduleOwner() {},
      clear() {},
    })
    mocks.resolvePageOptions.mockReturnValue({ from: 'resolved-options' })
    mocks.getInitialNavigationRunner.mockReturnValue(undefined)
    mocks.ensureInitialNavigation.mockReturnValue(undefined)
    mocks.getInitialNavigationPromise.mockReturnValue(undefined)
    mocks.cancelInitialNavigation.mockReset()
    mocks.attachOptionalPageLifecycleHooks.mockImplementation((hooks: Record<string, any>, options: any) => {
      if (options?.enableOnRouteDone) {
        hooks.onRouteDone = vi.fn()
      }
      return hooks
    })
    mocks.ensureInitialNavigation.mockImplementation((instance: object, query?: unknown, options?: { start?: boolean, onComplete?: (shouldMount: boolean) => void }) => {
      const existing = mocks.initialNavigationControllers.get(instance)
      if (existing) {
        if (options?.onComplete) {
          existing.callbacks.add(options.onComplete)
        }
        if (options?.start !== false) {
          existing.start(query)
        }
        return existing.promise
      }
      const runner = mocks.getInitialNavigationRunner()
      if (!runner) {
        return undefined
      }
      let resolveResult!: (value: boolean) => void
      let started = false
      const callbacks = new Set<(shouldMount: boolean) => void>()
      const promise = new Promise<boolean>((resolve) => {
        resolveResult = resolve
      })
      const start = (startQuery?: unknown) => {
        if (started) {
          return
        }
        started = true
        void runner(instance, startQuery ?? query).then((result: any) => {
          const shouldMount = !(result && result.__wevuNavigationFailure)
          resolveResult(shouldMount)
          for (const callback of callbacks) {
            callback(shouldMount)
          }
        })
      }
      mocks.initialNavigationControllers.set(instance, { promise, start, callbacks })
      if (options?.onComplete) {
        callbacks.add(options.onComplete)
      }
      if (options?.start !== false) {
        start(query)
      }
      return promise
    })
    mocks.getInitialNavigationPromise.mockImplementation((instance: object) => mocks.initialNavigationControllers.get(instance)?.promise)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('attaches optional hooks and keeps non-page lifecycle minimal', () => {
    const userOnShow = vi.fn(() => 'show-result')
    const userOnHide = vi.fn(() => 'hide-result')
    const userOnUnload = vi.fn(() => 'unload-result')
    const hooks = createPageLifecycleHooks({
      runtimeApp: {} as any,
      watch: undefined,
      setup: undefined as any,
      userOnShow,
      userOnHide,
      userOnUnload,
      isPage: false,
      enableOnSaveExitState: false,
      enableOnPullDownRefresh: false,
      enableOnReachBottom: false,
      enableOnPageScroll: false,
      enableOnRouteDone: false,
      enableOnRouteDoneFallback: false,
      enableOnTabItemTap: false,
      enableOnResize: false,
      enableOnShareAppMessage: false,
      enableOnShareTimeline: false,
      enableOnAddToFavorites: false,
      effectiveOnSaveExitState: vi.fn(),
      effectiveOnPullDownRefresh: vi.fn(),
      effectiveOnReachBottom: vi.fn(),
      effectiveOnPageScroll: vi.fn(),
      effectiveOnRouteDone: vi.fn(),
      effectiveOnTabItemTap: vi.fn(),
      effectiveOnResize: vi.fn(),
      effectiveOnShareAppMessage: vi.fn(),
      effectiveOnShareTimeline: vi.fn(),
      effectiveOnAddToFavorites: vi.fn(),
      hasHook: vi.fn(() => false),
    } as any)

    const instance: any = {}
    expect(hooks.onShow.call(instance, 'a')).toBe('show-result')
    expect(hooks.onHide.call(instance, 'b')).toBe('hide-result')
    expect(hooks.onUnload.call(instance, 'c')).toBe('unload-result')

    expect(mocks.attachOptionalPageLifecycleHooks).toHaveBeenCalledTimes(1)
    expect(mocks.ensureMiniProgramGlobalPatched).not.toHaveBeenCalled()
    expect(mocks.bindCurrentPageInstance).not.toHaveBeenCalled()
    expect(mocks.notifyRouteStateSync).not.toHaveBeenCalled()
    expect(mocks.releaseCurrentPageInstance).not.toHaveBeenCalled()
    expect(mocks.setRuntimeSetDataVisibility).toHaveBeenNthCalledWith(1, instance, true)
    expect(mocks.setRuntimeSetDataVisibility).toHaveBeenNthCalledWith(2, instance, false)
    expect(mocks.teardownRuntimeInstance).toHaveBeenCalledWith(instance)
  })

  it('makes onLoad idempotent and wires page-only lifecycle helpers', () => {
    const userOnLoad = vi.fn(() => 'load-result')
    const hooks = createPageLifecycleHooks({
      runtimeApp: {} as any,
      watch: { count: 'onCount' } as any,
      setup: vi.fn() as any,
      userOnLoad,
      isPage: true,
      enableOnSaveExitState: false,
      enableOnPullDownRefresh: false,
      enableOnReachBottom: false,
      enableOnPageScroll: false,
      enableOnRouteDone: false,
      enableOnRouteDoneFallback: false,
      enableOnTabItemTap: false,
      enableOnResize: false,
      enableOnShareAppMessage: true,
      enableOnShareTimeline: false,
      enableOnAddToFavorites: false,
      effectiveOnSaveExitState: vi.fn(),
      effectiveOnPullDownRefresh: vi.fn(),
      effectiveOnReachBottom: vi.fn(),
      effectiveOnPageScroll: vi.fn(),
      effectiveOnRouteDone: vi.fn(),
      effectiveOnTabItemTap: vi.fn(),
      effectiveOnResize: vi.fn(),
      effectiveOnShareAppMessage: vi.fn(),
      effectiveOnShareTimeline: vi.fn(),
      effectiveOnAddToFavorites: vi.fn(),
      hasHook: vi.fn(() => false),
    } as any)

    const instance: any = {}
    expect(hooks.onLoad.call(instance, { from: 'args' })).toBe('load-result')
    expect(hooks.onLoad.call(instance, { from: 'args-again' })).toBeUndefined()

    expect(instance[WEVU_ON_LOAD_CALLED_KEY]).toBe(true)
    expect(mocks.mountRuntimeInstance).toHaveBeenCalledTimes(1)
    expect(mocks.enableDeferredSetData).toHaveBeenCalledTimes(1)
    expect(mocks.ensurePageShareMenus).toHaveBeenCalledWith({
      enableOnShareAppMessage: true,
      enableOnShareTimeline: false,
    })
    expect(mocks.callHookList).toHaveBeenCalledWith(instance, 'onLoad', [{ from: 'args' }])
  })

  it('waits for initial router navigation before mounting a page', async () => {
    const order: string[] = []
    let resolveNavigation!: () => void
    const initialNavigation = vi.fn(() => {
      order.push('guard-start')
      return new Promise<void>((resolve) => {
        resolveNavigation = () => {
          order.push('guard-done')
          resolve()
        }
      })
    })
    mocks.getInitialNavigationRunner.mockReturnValue(initialNavigation)
    mocks.mountRuntimeInstance.mockImplementation(() => {
      order.push('mounted')
    })

    const hooks = createPageLifecycleHooks({
      runtimeApp: {} as any,
      watch: undefined,
      setup: undefined as any,
      isPage: true,
      enableOnSaveExitState: false,
      enableOnPullDownRefresh: false,
      enableOnReachBottom: false,
      enableOnPageScroll: false,
      enableOnRouteDone: false,
      enableOnRouteDoneFallback: false,
      enableOnTabItemTap: false,
      enableOnResize: false,
      enableOnShareAppMessage: false,
      enableOnShareTimeline: false,
      enableOnAddToFavorites: false,
      effectiveOnSaveExitState: vi.fn(),
      effectiveOnPullDownRefresh: vi.fn(),
      effectiveOnReachBottom: vi.fn(),
      effectiveOnPageScroll: vi.fn(),
      effectiveOnRouteDone: vi.fn(),
      effectiveOnTabItemTap: vi.fn(),
      effectiveOnResize: vi.fn(),
      effectiveOnShareAppMessage: vi.fn(),
      effectiveOnShareTimeline: vi.fn(),
      effectiveOnAddToFavorites: vi.fn(),
      hasHook: vi.fn(() => false),
    } as any)

    const instance: any = {}
    const pending = hooks.onLoad.call(instance, { from: 'args' })
    expect(pending).toBeInstanceOf(Promise)
    expect(order).toEqual(['guard-start'])
    expect(mocks.mountRuntimeInstance).not.toHaveBeenCalled()

    hooks.onReady.call(instance, 'ready')
    expect(mocks.callHookList).not.toHaveBeenCalledWith(instance, 'onReady', ['ready'])

    resolveNavigation()
    await pending
    await Promise.resolve()
    expect(order).toEqual(['guard-start', 'guard-done', 'mounted'])
    expect(mocks.callHookList).toHaveBeenCalledWith(instance, 'onReady', ['ready'])
  })

  it('does not mount or run ready hooks when the initial guard aborts', async () => {
    const initialNavigation = vi.fn(() => Promise.resolve({
      __wevuNavigationFailure: true,
      type: 4,
    } as any))
    mocks.getInitialNavigationRunner.mockReturnValue(initialNavigation)
    const hooks = createPageLifecycleHooks({
      runtimeApp: {} as any,
      watch: undefined,
      setup: undefined as any,
      isPage: true,
      enableOnSaveExitState: false,
      enableOnPullDownRefresh: false,
      enableOnReachBottom: false,
      enableOnPageScroll: false,
      enableOnRouteDone: false,
      enableOnRouteDoneFallback: false,
      enableOnTabItemTap: false,
      enableOnResize: false,
      enableOnShareAppMessage: false,
      enableOnShareTimeline: false,
      enableOnAddToFavorites: false,
      effectiveOnSaveExitState: vi.fn(),
      effectiveOnPullDownRefresh: vi.fn(),
      effectiveOnReachBottom: vi.fn(),
      effectiveOnPageScroll: vi.fn(),
      effectiveOnRouteDone: vi.fn(),
      effectiveOnTabItemTap: vi.fn(),
      effectiveOnResize: vi.fn(),
      effectiveOnShareAppMessage: vi.fn(),
      effectiveOnShareTimeline: vi.fn(),
      effectiveOnAddToFavorites: vi.fn(),
      hasHook: vi.fn(() => false),
    } as any)

    const instance: any = {}
    const loadPromise = hooks.onLoad.call(instance, {})
    hooks.onReady.call(instance, 'ready')
    await loadPromise
    await Promise.resolve()

    expect(mocks.mountRuntimeInstance).not.toHaveBeenCalled()
    expect(mocks.callHookList).not.toHaveBeenCalledWith(instance, 'onReady', ['ready'])
  })

  it('replays onLoad from onShow, resets routeDone flag, and releases page instance on hide/unload', () => {
    const userOnShow = vi.fn(() => 'show-result')
    const userOnHide = vi.fn(() => 'hide-result')
    const userOnUnload = vi.fn(() => 'unload-result')
    const hooks = createPageLifecycleHooks({
      runtimeApp: {} as any,
      watch: undefined,
      setup: undefined as any,
      userOnShow,
      userOnHide,
      userOnUnload,
      isPage: true,
      enableOnSaveExitState: false,
      enableOnPullDownRefresh: false,
      enableOnReachBottom: false,
      enableOnPageScroll: false,
      enableOnRouteDone: false,
      enableOnRouteDoneFallback: false,
      enableOnTabItemTap: false,
      enableOnResize: false,
      enableOnShareAppMessage: false,
      enableOnShareTimeline: true,
      enableOnAddToFavorites: false,
      effectiveOnSaveExitState: vi.fn(),
      effectiveOnPullDownRefresh: vi.fn(),
      effectiveOnReachBottom: vi.fn(),
      effectiveOnPageScroll: vi.fn(),
      effectiveOnRouteDone: vi.fn(),
      effectiveOnTabItemTap: vi.fn(),
      effectiveOnResize: vi.fn(),
      effectiveOnShareAppMessage: vi.fn(),
      effectiveOnShareTimeline: vi.fn(),
      effectiveOnAddToFavorites: vi.fn(),
      hasHook: vi.fn(() => false),
    } as any)

    const instance: any = {}
    expect(hooks.onShow.call(instance, 'show')).toBe('show-result')
    expect(instance[WEVU_ON_LOAD_CALLED_KEY]).toBe(true)
    expect(instance[WEVU_ROUTE_DONE_CALLED_KEY]).toBe(false)
    expect(mocks.ensureMiniProgramGlobalPatched).toHaveBeenCalledTimes(1)
    expect(mocks.bindCurrentPageInstance).toHaveBeenCalledWith(instance)
    expect(mocks.notifyRouteStateSync).toHaveBeenCalledWith({
      page: instance,
      source: 'page',
    })
    expect(mocks.resolvePageOptions).toHaveBeenCalledWith(instance)
    expect(mocks.mountRuntimeInstance).toHaveBeenCalledTimes(1)

    expect(hooks.onHide.call(instance, 'hide')).toBe('hide-result')
    expect(hooks.onUnload.call(instance, 'unload')).toBe('unload-result')
    expect(mocks.releaseCurrentPageInstance).toHaveBeenCalledTimes(2)
    expect(mocks.setRuntimeSetDataVisibility).toHaveBeenNthCalledWith(1, instance, true)
    expect(mocks.setRuntimeSetDataVisibility).toHaveBeenNthCalledWith(2, instance, false)
    expect(mocks.teardownRuntimeInstance).toHaveBeenCalledWith(instance)
  })

  it('schedules active template refs before ready and falls back to routeDone only when still pending', async () => {
    const userOnReady = vi.fn(() => 'ready-result')
    const hooks = createPageLifecycleHooks({
      runtimeApp: {} as any,
      watch: undefined,
      setup: undefined as any,
      userOnReady,
      isPage: true,
      enableOnSaveExitState: false,
      enableOnPullDownRefresh: false,
      enableOnReachBottom: false,
      enableOnPageScroll: false,
      enableOnRouteDone: true,
      enableOnRouteDoneFallback: true,
      enableOnTabItemTap: false,
      enableOnResize: false,
      enableOnShareAppMessage: false,
      enableOnShareTimeline: false,
      enableOnAddToFavorites: false,
      effectiveOnSaveExitState: vi.fn(),
      effectiveOnPullDownRefresh: vi.fn(),
      effectiveOnReachBottom: vi.fn(),
      effectiveOnPageScroll: vi.fn(),
      effectiveOnRouteDone: vi.fn(),
      effectiveOnTabItemTap: vi.fn(),
      effectiveOnResize: vi.fn(),
      effectiveOnShareAppMessage: vi.fn(),
      effectiveOnShareTimeline: vi.fn(),
      effectiveOnAddToFavorites: vi.fn(),
      hasHook: vi.fn(() => false),
    } as any)

    const instance: any = {
      [WEVU_ON_LOAD_CALLED_KEY]: true,
      __wevuTemplateRefs: [
        { selector: '.leaf', inFor: false, name: 'leaf', kind: 'component' },
      ],
    }
    expect(hooks.onReady.call(instance, 'first')).toBeUndefined()
    expect(instance[WEVU_READY_CALLED_KEY]).toBe(true)
    expect(mocks.scheduleTemplateRefUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.scheduleTemplateRefUpdate.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.callHookList.mock.invocationCallOrder[0])
    expect(mocks.callHookList).toHaveBeenCalledWith(instance, 'onReady', ['first'])
    expect(userOnReady).toHaveBeenCalledWith('first')

    instance[WEVU_ROUTE_DONE_CALLED_KEY] = true
    vi.runAllTimers()
    expect((hooks as any).onRouteDone).toBeDefined()

    expect(hooks.onReady.call(instance, 'second')).toBe('ready-result')
    expect(mocks.scheduleTemplateRefUpdate).toHaveBeenCalledTimes(1)
    expect(userOnReady).toHaveBeenCalledWith('second')
  })

  it('invokes routeDone fallback timer when routeDone stays pending', () => {
    const hooks = createPageLifecycleHooks({
      runtimeApp: {} as any,
      watch: undefined,
      setup: undefined as any,
      isPage: true,
      enableOnSaveExitState: false,
      enableOnPullDownRefresh: false,
      enableOnReachBottom: false,
      enableOnPageScroll: false,
      enableOnRouteDone: true,
      enableOnRouteDoneFallback: true,
      enableOnTabItemTap: false,
      enableOnResize: false,
      enableOnShareAppMessage: false,
      enableOnShareTimeline: false,
      enableOnAddToFavorites: false,
      effectiveOnSaveExitState: vi.fn(),
      effectiveOnPullDownRefresh: vi.fn(),
      effectiveOnReachBottom: vi.fn(),
      effectiveOnPageScroll: vi.fn(),
      effectiveOnRouteDone: vi.fn(),
      effectiveOnTabItemTap: vi.fn(),
      effectiveOnResize: vi.fn(),
      effectiveOnShareAppMessage: vi.fn(),
      effectiveOnShareTimeline: vi.fn(),
      effectiveOnAddToFavorites: vi.fn(),
      hasHook: vi.fn(() => false),
    } as any)

    const instance: any = {}
    const routeDoneSpy = hooks.onRouteDone as any

    hooks.onReady.call(instance)
    vi.runAllTimers()

    expect(routeDoneSpy).toHaveBeenCalledTimes(1)
  })
})
