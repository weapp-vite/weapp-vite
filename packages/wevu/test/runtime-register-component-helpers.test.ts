import { describe, expect, it, vi } from 'vitest'
import { resolveComponentFeatures } from '@/runtime/register/component/features'
import { createPageLifecycleHooks } from '@/runtime/register/component/lifecycle'
import { createComponentMethods } from '@/runtime/register/component/methods'
import { createPropsSync } from '@/runtime/register/component/props'
import { enableDeferredSetData, mountRuntimeInstance, teardownRuntimeInstance } from '@/runtime/register/runtimeInstance'
import { refreshOwnerSnapshotFromInstance } from '@/runtime/register/snapshot'

vi.mock('@/runtime/register/snapshot', () => ({
  refreshOwnerSnapshotFromInstance: vi.fn(),
}))

vi.mock('@/runtime/register/runtimeInstance', () => ({
  mountRuntimeInstance: vi.fn(),
  teardownRuntimeInstance: vi.fn(),
  enableDeferredSetData: vi.fn(),
}))

describe('runtime: register component helpers', () => {
  it('resolves feature flags and effective handlers', () => {
    const userOnReachBottom = vi.fn()
    const resolved = resolveComponentFeatures({
      features: { enableOnPullDownRefresh: true },
      userOnReachBottom,
    })

    expect(resolved.enableOnPullDownRefresh).toBe(true)
    expect(resolved.enableOnReachBottom).toBe(true)
    expect(resolved.effectiveOnReachBottom).toBe(userOnReachBottom)
  })

  it('creates component methods with runtime binding', () => {
    const user = { tap: vi.fn() }
    const runtimeMethods = {
      tap: vi.fn(function (this: any) {
        return this.marker
      }),
      __weapp_vite_owner: vi.fn(),
    }
    const { finalMethods } = createComponentMethods({
      userMethods: user,
      runtimeMethods,
    })
    const instance: any = {
      __wevu: {
        proxy: { marker: 'ok' },
        methods: runtimeMethods,
      },
    }

    const result = finalMethods.tap.call(instance, 1)
    expect(runtimeMethods.tap).toHaveBeenCalledWith(1)
    expect(user.tap).toHaveBeenCalledWith(1)
    expect(result).toBe('ok')
    expect(finalMethods.__weapp_vite_owner).toBe(runtimeMethods.__weapp_vite_owner)
  })

  it('syncs props into __wevuProps via observers', () => {
    const propsProxy: any = { foo: 1 }
    const instance: any = { __wevuProps: propsProxy }
    const { finalObservers } = createPropsSync({
      restOptions: { properties: { foo: null } },
    })

    finalObservers.foo.call(instance, 2)
    expect(propsProxy.foo).toBe(2)
    expect(vi.mocked(refreshOwnerSnapshotFromInstance)).toHaveBeenCalledWith(instance)
  })

  it('creates page lifecycle hooks that mount and teardown', () => {
    const userOnLoad = vi.fn()
    const hooks = createPageLifecycleHooks({
      runtimeApp: {} as any,
      watch: undefined,
      setup: undefined as any,
      userOnLoad,
      enableOnSaveExitState: false,
      enableOnPullDownRefresh: false,
      enableOnReachBottom: false,
      enableOnPageScroll: false,
      enableOnRouteDone: false,
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
      hasHook: () => false,
    })

    const instance: any = {}
    hooks.onLoad.call(instance, 'a')
    expect(mountRuntimeInstance).toHaveBeenCalled()
    expect(enableDeferredSetData).toHaveBeenCalledWith(instance)
    expect(userOnLoad).toHaveBeenCalledWith('a')

    hooks.onUnload.call(instance, 'b')
    expect(teardownRuntimeInstance).toHaveBeenCalledWith(instance)
  })
})
