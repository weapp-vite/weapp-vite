import type { RuntimeApp } from '@/runtime/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { registerComponent } from '@/runtime/register'

const mockState = vi.hoisted(() => {
  const hooks = {
    onShow: vi.fn(),
    onHide: vi.fn(),
    onResize: vi.fn(),
    onReady: vi.fn(),
    onUnload: vi.fn(),
  }
  return {
    hooks,
    createPageLifecycleHooks: vi.fn(() => hooks),
  }
})

vi.mock('@/runtime/register/component/lifecycle', () => ({
  createPageLifecycleHooks: mockState.createPageLifecycleHooks,
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

  return { app }
}

describe('registerComponent (page lifecycles)', () => {
  it('routes component page lifecycles through page hooks', () => {
    const { app } = createRuntimeAppStub()
    const userReady = vi.fn()
    const userDetached = vi.fn()
    const userShow = vi.fn()
    const userHide = vi.fn()
    const userResize = vi.fn()

    registerComponent(app, {}, undefined, undefined, {
      lifetimes: {
        ready: userReady,
        detached: userDetached,
      },
      pageLifetimes: {
        show: userShow,
        hide: userHide,
        resize: userResize,
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
    options.lifetimes.ready.call(instance, 'd')
    options.lifetimes.detached.call(instance, 'e')

    expect(mockState.hooks.onShow).toHaveBeenCalledWith('a')
    expect(mockState.hooks.onHide).toHaveBeenCalledWith('b')
    expect(mockState.hooks.onResize).toHaveBeenCalledWith('c')
    expect(mockState.hooks.onReady).toHaveBeenCalledWith('d')
    expect(mockState.hooks.onUnload).toHaveBeenCalledWith('e')

    expect(userShow).toHaveBeenCalledWith('a')
    expect(userHide).toHaveBeenCalledWith('b')
    expect(userResize).toHaveBeenCalledWith('c')
    expect(userReady).toHaveBeenCalledWith('d')
    expect(userDetached).toHaveBeenCalledWith('e')
  })
})
