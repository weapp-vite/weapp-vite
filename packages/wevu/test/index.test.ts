import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, nextTick, ref, watch } from '@/index'

async function flushJobs() {
  await nextTick()
  await nextTick()
}

const registeredPages: Record<string, any>[] = []
const registeredComponents: Record<string, any>[] = []
const registeredApps: Record<string, any>[] = []

beforeEach(() => {
  registeredPages.length = 0
  registeredComponents.length = 0
  registeredApps.length = 0
  ;(globalThis as any).Page = vi.fn((options: Record<string, any>) => {
    registeredPages.push(options)
  })
  ;(globalThis as any).Component = vi.fn((options: Record<string, any>) => {
    registeredComponents.push(options)
  })
  ;(globalThis as any).App = vi.fn((options: Record<string, any>) => {
    registeredApps.push(options)
  })
})

afterEach(() => {
  delete (globalThis as any).Page
  delete (globalThis as any).Component
  delete (globalThis as any).App
})

function createMockAdapter() {
  const calls: Record<string, any>[] = []
  return {
    calls,
    adapter: {
      setData(payload: Record<string, any>) {
        calls.push(payload)
      },
    },
  }
}

describe('runtime', () => {
  it('syncs reactive state to the adapter', async () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({
        count: 0,
        nested: {
          message: 'hello',
        },
      }),
      computed: {
        doubled(this: any) {
          return this.count * 2
        },
      },
      methods: {
        increment(this: any) {
          this.count += 1
        },
      },
    })

    const instance = app.mount(adapter)

    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({
      count: 0,
      nested: {
        message: 'hello',
      },
      doubled: 0,
    })

    instance.methods.increment()
    await flushJobs()
    expect(calls.at(-1)).toEqual({
      count: 1,
      doubled: 2,
    })

    instance.proxy.count = 5
    await flushJobs()
    expect(calls.at(-1)).toMatchObject({
      count: 5,
      doubled: 10,
    })
  })

  it('supports two-way bindings via bindModel', async () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({
        form: {
          name: 'alice',
        },
      }),
    })
    const instance = app.mount(adapter)
    expect(calls).toHaveLength(1)

    const binding = instance.bindModel<string>('form.name')

    expect(binding.value).toBe('alice')

    binding.value = 'bob'
    await flushJobs()
    expect(instance.state.form.name).toBe('bob')
    expect(calls.at(-1)).toEqual({ 'form.name': 'bob' })

    const model = binding.model()
    model.onInput?.({ detail: { value: 'carol' } })
    await flushJobs()
    expect(binding.value).toBe('carol')
    expect(calls.at(-1)).toEqual({ 'form.name': 'carol' })
  })

  it('allows writing to computed properties with setters', async () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({
        count: 1,
      }),
      computed: {
        label: {
          get(this: any) {
            return `count:${this.count}`
          },
          set(this: any, value: string) {
            const [, numberPart] = value.split(':')
            this.count = Number(numberPart)
          },
        },
      },
    })
    const instance = app.mount(adapter)
    expect(calls.at(-1)).toEqual({
      count: 1,
      label: 'count:1',
    })

    const binding = instance.bindModel('label')
    binding.value = 'count:8'
    await flushJobs()

    expect(instance.state.count).toBe(8)
    expect(instance.proxy.label).toBe('count:8')
    expect(calls.at(-1)).toEqual({
      count: 8,
      label: 'count:8',
    })
  })

  it('stops propagating updates after unmount', async () => {
    const { calls, adapter } = createMockAdapter()
    const app = createApp({
      data: () => ({
        count: 0,
      }),
    })
    const instance = app.mount(adapter)
    expect(calls).toHaveLength(1)

    instance.unmount()
    instance.proxy.count = 10
    await flushJobs()

    expect(calls).toHaveLength(1)
  })
})

describe('reactivity primitives', () => {
  it('watch reacts to ref changes', async () => {
    const value = ref(1)
    const observed: number[] = []

    const stop = watch(value, (val) => {
      observed.push(val)
    }, { immediate: true })

    value.value = 2
    await flushJobs()

    value.value = 4
    await flushJobs()

    stop()

    expect(observed).toEqual([1, 2, 4])
  })
})

describe('createApp', () => {
  it('registers mini program App and bridges runtime', async () => {
    createApp({
      data: () => ({
        logs: [] as string[],
      }),
      methods: {
        appendLog(this: any, message: string) {
          this.logs = [...this.logs, message]
        },
        markReady(this: any) {
          this.appendLog('ready')
        },
      },
      globalData: {
        ready: false,
        logs: [] as string[],
      },
      setup({ runtime, watch, instance }) {
        const app = instance as any
        runtime.methods.appendLog('setup')
        watch(
          () => runtime.proxy.logs.slice(),
          (logs) => {
            app.globalData.logs = logs.slice()
          },
          {
            immediate: true,
            deep: true,
          },
        )
      },
      onLaunch(this: any) {
        this.$wevu?.methods.markReady()
        this.globalData.ready = true
      },
      onShow(this: any) {
        this.$wevu?.methods.appendLog('show')
      },
    })

    expect(registeredApps).toHaveLength(1)
    const appOptions = registeredApps[0]
    expect(typeof appOptions.onLaunch).toBe('function')
    expect(typeof appOptions.appendLog).toBe('function')

    const appInstance: Record<string, any> = {
      globalData: appOptions.globalData,
    }

    appOptions.onLaunch.call(appInstance)
    const runtime = appInstance.$wevu
    expect(runtime).toBeDefined()
    expect(appInstance.globalData.ready).toBe(true)
    await flushJobs()
    expect(appInstance.globalData.logs).toEqual(['setup', 'ready'])

    appOptions.appendLog.call(appInstance, 'manual')
    await flushJobs()
    expect(runtime!.state.logs.at(-1)).toBe('manual')

    appOptions.onShow.call(appInstance)
    await flushJobs()
    expect(runtime!.state.logs.at(-1)).toBe('show')
  })

  it('registers App even without setup/watch/mp options', async () => {
    createApp({
      data: () => ({
        ready: false,
      }),
      methods: {
        markReady(this: any) {
          this.ready = true
        },
      },
    })

    expect(registeredApps).toHaveLength(1)
    const appOptions = registeredApps[0]
    expect(typeof appOptions.onLaunch).toBe('function')

    const appInstance: Record<string, any> = {}
    appOptions.onLaunch.call(appInstance)
    const runtime = appInstance.$wevu
    expect(runtime).toBeDefined()
    expect(runtime!.state.ready).toBe(false)

    runtime!.methods.markReady()
    await flushJobs()
    expect(runtime!.state.ready).toBe(true)
  })
})

describe('defineComponent', () => {
  it('mounts runtime on component lifecycle and syncs state', async () => {
    const setData = vi.fn()

    defineComponent({
      data: () => ({
        count: 1,
      }),
      methods: {
        increment(this: any) {
          this.count += 1
        },
      },
    })

    expect(registeredComponents).toHaveLength(1)
    const componentOptions = registeredComponents[0]

    expect(typeof componentOptions.lifetimes?.attached).toBe('function')
    expect(typeof componentOptions.lifetimes?.detached).toBe('function')
    expect(typeof componentOptions.methods?.increment).toBe('function')

    const componentInstance: Record<string, any> = { setData }

    componentOptions.lifetimes.attached.call(componentInstance)
    expect(componentInstance.$wevu).toBeDefined()
    expect(setData).toHaveBeenCalledTimes(1)
    expect(setData.mock.calls[0][0]).toMatchObject({ count: 1 })

    componentOptions.methods.increment.call(componentInstance)
    await flushJobs()
    expect(setData.mock.calls.at(-1)?.[0]).toMatchObject({ count: 2 })

    componentOptions.lifetimes.detached.call(componentInstance)
    expect(componentInstance.$wevu).toBeUndefined()
  })
})
