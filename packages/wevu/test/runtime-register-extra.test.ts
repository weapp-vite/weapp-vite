import type { RuntimeApp } from '@/runtime/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '@/runtime/app'
import { callHookReturn, setCurrentInstance } from '@/runtime/hooks'
import {
  mountRuntimeInstance,
  registerApp,
  registerComponent,
  runSetupFunction,
  teardownRuntimeInstance,
} from '@/runtime/register'

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
    expect(typeof target.$wevu).toBe('object')

    target.__wevu.adapter.setData({ a: 1 })
    target.__wevu.adapter.__wevu_enableSetData()
    expect(target.setData).toHaveBeenCalledWith({ a: 1 })

    teardownRuntimeInstance(target)
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

    target.__wevuHooks = { onUnload: [vi.fn()] }
    target.__wevuWatchStops = [
      () => {
        throw new Error('stop error')
      },
    ]

    teardownRuntimeInstance(target)
    expect(runtime.unmount).toHaveBeenCalled()
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
    options.onError.call(instance)

    expect(userOnLaunch).toHaveBeenCalled()
    expect(userOnShow).toHaveBeenCalled()
    expect(userOnHide).toHaveBeenCalled()
    expect(userOnError).toHaveBeenCalled()

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
      __wevuHooks: {
        onShareAppMessage: () => ({ title: 'hook' }),
      },
    }

    options.lifetimes.created.call(instance)
    options.lifetimes.attached.call(instance)
    options.pageLifetimes.show.call(instance)

    const exportValue = options.export.call({ __wevuExposed: { bar: 1 } })
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

    const exported = options.export.call({ __wevuExposed: { ok: true } })
    expect(exported).toBe('invalid')

    const save = options.onSaveExitState.call({ __wevuHooks: {} })
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
    const instance: any = { __wevuHooks: {}, setData: vi.fn() }
    const result = options.onShareTimeline.call(instance)
    expect(result).toEqual({ title: 'user' })

    instance.__wevuHooks = { onShareTimeline: () => ({ title: 'hook' }) }
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
