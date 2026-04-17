import {
  WEVU_ON_LOAD_CALLED_KEY,
  WEVU_READY_CALLED_KEY,
  WEVU_ROUTE_DONE_CALLED_KEY,
} from '@weapp-core/constants'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
  }
})

vi.mock('@/runtime/hooks', () => ({
  callHookList: mocks.callHookList,
}))

vi.mock('@/runtime/templateRefs', () => ({
  scheduleTemplateRefUpdate: mocks.scheduleTemplateRefUpdate,
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
    for (const mock of Object.values(mocks)) {
      mock.mockReset?.()
    }
    mocks.scheduleTemplateRefUpdate.mockImplementation((_target: any, task: () => void) => task())
    mocks.resolvePageOptions.mockReturnValue({ from: 'resolved-options' })
    mocks.attachOptionalPageLifecycleHooks.mockImplementation((hooks: Record<string, any>, options: any) => {
      if (options?.enableOnRouteDone) {
        hooks.onRouteDone = vi.fn()
      }
      return hooks
    })
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
    expect(mocks.resolvePageOptions).toHaveBeenCalledWith(instance)
    expect(mocks.mountRuntimeInstance).toHaveBeenCalledTimes(1)

    expect(hooks.onHide.call(instance, 'hide')).toBe('hide-result')
    expect(hooks.onUnload.call(instance, 'unload')).toBe('unload-result')
    expect(mocks.releaseCurrentPageInstance).toHaveBeenCalledTimes(2)
    expect(mocks.setRuntimeSetDataVisibility).toHaveBeenNthCalledWith(1, instance, true)
    expect(mocks.setRuntimeSetDataVisibility).toHaveBeenNthCalledWith(2, instance, false)
    expect(mocks.teardownRuntimeInstance).toHaveBeenCalledWith(instance)
  })

  it('schedules ready callback once and falls back to routeDone only when still pending', async () => {
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

    const instance: any = {}
    expect(hooks.onReady.call(instance, 'first')).toBeUndefined()
    expect(instance[WEVU_READY_CALLED_KEY]).toBe(true)
    expect(mocks.scheduleTemplateRefUpdate).toHaveBeenCalledTimes(1)
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
