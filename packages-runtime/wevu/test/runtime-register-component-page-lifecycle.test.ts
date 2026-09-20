import type { RuntimeApp } from '@/runtime/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { registerComponent } from '@/runtime/register'

const mockState = vi.hoisted(() => {
  const hooks = {
    onShow: vi.fn(),
    onHide: vi.fn(),
    onResize: vi.fn(),
    onRouteDone: vi.fn(),
    onReady: vi.fn(),
    onUnload: vi.fn(),
    onPullDownRefresh: vi.fn(),
  }
  return {
    hooks,
    createPageLifecycleHooks: vi.fn(() => hooks),
    getInitialNavigationPromise: vi.fn(() => undefined),
    ensureInitialNavigation: vi.fn(() => undefined),
  }
})

vi.mock('@/runtime/register/component/lifecycle', () => ({
  createPageLifecycleHooks: mockState.createPageLifecycleHooks,
  getInitialNavigationPromise: mockState.getInitialNavigationPromise,
  ensureInitialNavigation: mockState.ensureInitialNavigation,
}))

const componentCalls: Record<string, any>[] = []

beforeEach(() => {
  componentCalls.length = 0
  ;(globalThis as any).Component = (options: Record<string, any>) => {
    componentCalls.push(options)
  }
  vi.clearAllMocks()
})

afterEach(() => {
  delete (globalThis as any).Component
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

describe('registerComponent (page lifecycles)', () => {
  it('routes component page lifecycles through page hooks', () => {
    const { app } = createRuntimeAppStub()
    const userReady = vi.fn()
    const userDetached = vi.fn()
    const userShow = vi.fn()
    const userHide = vi.fn()
    const userResize = vi.fn()
    const userRouteDone = vi.fn()

    registerComponent(app, {}, undefined, undefined, {
      lifetimes: {
        ready: userReady,
        detached: userDetached,
      },
      pageLifetimes: {
        show: userShow,
        hide: userHide,
        resize: userResize,
        routeDone: userRouteDone,
      },
      features: {
        enableOnPullDownRefresh: true,
      },
    } as any)

    const options = componentCalls.pop()!
    const instance: any = {}

    options.pageLifetimes.show.call(instance, 'a')
    options.pageLifetimes.hide.call(instance, 'b')
    options.pageLifetimes.resize.call(instance, 'c')
    options.pageLifetimes.routeDone.call(instance, 'r')
    options.lifetimes.ready.call(instance, 'd')
    options.lifetimes.detached.call(instance, 'e')
    options.methods.onPullDownRefresh.call(instance, 'p')

    expect(mockState.hooks.onShow).toHaveBeenCalledWith('a')
    expect(mockState.hooks.onHide).toHaveBeenCalledWith('b')
    expect(mockState.hooks.onResize).toHaveBeenCalledWith('c')
    expect(mockState.hooks.onRouteDone).toHaveBeenCalledWith('r')
    expect(mockState.hooks.onReady).toHaveBeenCalledWith('d')
    expect(mockState.hooks.onUnload).toHaveBeenCalledWith('e')
    expect(mockState.hooks.onPullDownRefresh).toHaveBeenCalledWith('p')

    expect(userShow).toHaveBeenCalledWith('a')
    expect(userHide).toHaveBeenCalledWith('b')
    expect(userResize).toHaveBeenCalledWith('c')
    expect(userRouteDone).toHaveBeenCalledWith('r')
    expect(userReady).toHaveBeenCalledWith('d')
    expect(userDetached).toHaveBeenCalledWith('e')
  })

  it('finishes page detached phases before rethrowing the first failure', () => {
    const { app } = createRuntimeAppStub()
    const order: string[] = []
    const firstFailure = new Error('page unload failed')
    mockState.hooks.onUnload.mockImplementationOnce(() => {
      order.push('page:onUnload')
      throw firstFailure
    })

    registerComponent(app, {}, undefined, undefined, {
      __wevu_isPage: true,
      beforeUnmount() {
        order.push('vue:beforeUnmount')
      },
      beforeDestroy() {
        order.push('vue:beforeDestroy')
      },
      unmounted() {
        order.push('vue:unmounted')
        throw new Error('unmounted failed')
      },
      destroyed() {
        order.push('vue:destroyed')
      },
      lifetimes: {
        detached() {
          order.push('user:detached')
          throw new Error('detached failed')
        },
      },
    } as any)

    const options = componentCalls.pop()!
    const instance: any = {}

    expect(() => options.lifetimes.detached.call(instance)).toThrow(firstFailure)
    expect(order).toEqual([
      'vue:beforeUnmount',
      'vue:beforeDestroy',
      'page:onUnload',
      'user:detached',
      'vue:unmounted',
      'vue:destroyed',
    ])
  })

  it('finishes component detached phases after runtime teardown fails', () => {
    const { app, runtime } = createRuntimeAppStub()
    const order: string[] = []
    const firstFailure = new Error('runtime unmount failed')
    runtime.unmount.mockImplementation(() => {
      order.push('runtime:unmount')
      throw firstFailure
    })

    registerComponent(app, {}, undefined, undefined, {
      __wevu_isPage: false,
      beforeUnmount() {
        order.push('vue:beforeUnmount')
      },
      beforeDestroy() {
        order.push('vue:beforeDestroy')
      },
      unmounted() {
        order.push('vue:unmounted')
        throw new Error('unmounted failed')
      },
      destroyed() {
        order.push('vue:destroyed')
      },
      lifetimes: {
        detached() {
          order.push('user:detached')
          throw new Error('detached failed')
        },
      },
    } as any)

    const options = componentCalls.pop()!
    const instance: any = { properties: {}, setData: vi.fn() }
    options.lifetimes.created.call(instance)
    options.lifetimes.attached.call(instance)

    expect(() => options.lifetimes.detached.call(instance)).toThrow(firstFailure)
    expect(order).toEqual([
      'vue:beforeUnmount',
      'vue:beforeDestroy',
      'runtime:unmount',
      'vue:unmounted',
      'vue:destroyed',
      'user:detached',
    ])
  })
})
