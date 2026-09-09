import { runInNewContext } from 'node:vm'
import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY } from '@weapp-core/constants'
import { describe, expect, it, vi } from 'vitest'
import { statefulHmrRolldownRuntimeSource } from './runtimeSource'

interface HostInstance {
  data: { count: number, input: string }
  properties?: Record<string, unknown>
  setData: (data: HostInstance['data']) => void
}

type Hook = (this: HostInstance) => void

interface Definition {
  data?: HostInstance['data']
  properties?: Record<string, unknown>
  onLoad?: Hook
  onUnload?: Hook
  created?: Hook
  attached?: Hook
  increment?: Hook
  lifetimes?: Record<string, Hook>
  methods?: Record<string, Hook>
}

interface RuntimeBridge {
  installNative: (name: string, callback: (definition: Definition) => Definition) => void
  Page: (definition: Definition) => Definition
  Component: (definition: Definition) => void
  takeNativeDefinitions: (name: string) => Definition[]
  trackWevuComponent: (definition: Definition, refresh: (instance: HostInstance, snapshot?: HostInstance['data']) => void) => Definition
  beginUpdate: () => void
  endUpdate: () => void
  getDebugSnapshot: () => { instances: { moduleId: string, count: number }[] }
}

function createRuntime() {
  const timers: (() => void)[] = []
  const context = {
    DevRuntime: class {},
    setTimeout: (callback: () => void) => timers.push(callback),
  }
  const globals = runInNewContext(`${statefulHmrRolldownRuntimeSource}\nglobalThis`, context) as {
    __rolldown_runtime__: { currentModuleId: string }
  } & Record<typeof WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY, RuntimeBridge>
  const bridge = globals[WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY]
  globals.__rolldown_runtime__.currentModuleId = 'pages/counter'
  bridge.installNative('Page', definition => definition)
  return {
    bridge,
    finishUpdate() {
      bridge.endUpdate()
      for (const timer of timers.splice(0)) {
        timer()
      }
    },
    instanceCount() {
      return bridge.getDebugSnapshot().instances.find(value => value.moduleId === 'pages/counter')?.count ?? 0
    },
  }
}

function createHost(): HostInstance {
  const host: HostInstance = {
    data: { count: 0, input: '' },
    setData: vi.fn(data => Object.assign(host.data, data)),
  }
  return host
}

describe('stateful HMR host lifecycle tracking', () => {
  it.each(['new defaults', 'user reset'] as const)('captures current state when changed-key counts fall after %s', (reason) => {
    const runtime = createRuntime()
    const source = { data: { count: 0, input: '' }, lifetimes: { attached() {} } }
    const refresh = vi.fn((instance: HostInstance, snapshot?: HostInstance['data']) => {
      if (snapshot) {
        instance.setData(snapshot)
      }
    })
    const definition = runtime.bridge.trackWevuComponent(source, refresh)
    const host = createHost()
    definition.lifetimes!.attached!.call(host)
    host.data = { count: 2, input: 'held' }
    runtime.bridge.beginUpdate()
    const updated = reason === 'new defaults' ? { ...source, data: { count: 0, input: 'held' } } : source
    runtime.bridge.trackWevuComponent(updated, refresh)
    runtime.finishUpdate()
    host.data = { count: 4, input: reason === 'user reset' ? '' : 'held' }
    const expected = { ...host.data }
    runtime.bridge.beginUpdate()
    runtime.bridge.trackWevuComponent(updated, refresh)
    runtime.finishUpdate()
    expect(refresh).toHaveBeenLastCalledWith(host, expected)
    expect(host.data).toEqual(expected)
  })

  it('initializes new page defaults when native properties mirror data without changing active pages', () => {
    const runtime = createRuntime()
    const firstLoad = vi.fn()
    const nextLoad = vi.fn(function (this: HostInstance) {
      expect(this.data).toEqual({ count: 7, input: 'updated' })
    })
    const definition = runtime.bridge.Page({ data: { count: 0, input: '' }, onLoad: firstLoad, increment() {} })
    const active = createHost()
    definition.onLoad!.call(active)
    active.data = { count: 4, input: 'user value' }
    runtime.bridge.beginUpdate()
    runtime.bridge.Page({ data: { count: 7, input: 'updated' }, onLoad: nextLoad })
    runtime.finishUpdate()
    expect(active.data).toEqual({ count: 4, input: 'user value' })

    const nextPage = createHost()
    nextPage.properties = nextPage.data
    definition.increment!.call(nextPage)
    definition.onLoad!.call(nextPage)
    expect(nextPage.data).toEqual({ count: 7, input: 'updated' })
    expect(nextPage.setData).toHaveBeenCalledWith({ count: 7, input: 'updated' })
    expect(nextLoad).toHaveBeenCalledTimes(1)
    expect(firstLoad).toHaveBeenCalledTimes(1)
    expect(active.data).toEqual({ count: 4, input: 'user value' })
  })

  it.each([false, true])('updates mirrored component data while preserving declared props and lifecycle order (legacy hooks: %s)', (legacy) => {
    const runtime = createRuntime()
    const order: string[] = []
    const properties = { input: { type: String, value: '' } }
    const hooks = { created() {}, attached() {} }
    const initial = { data: { count: 0, input: '' }, properties, ...(legacy ? hooks : { lifetimes: hooks }) }
    runtime.bridge.Component(initial)
    const [definition] = runtime.bridge.takeNativeDefinitions('Component')
    runtime.bridge.beginUpdate()
    const updatedHooks: Record<string, Hook> = {
      created() {
        expect(this.data.count).toBe(7)
        expect(this.setData).not.toHaveBeenCalled()
        this.data.count++
        order.push('created')
      },
      attached() {
        expect(this.data).toEqual({ count: 8, input: 'parent prop' })
        order.push('attached')
      },
    }
    runtime.bridge.Component({
      data: { count: 7, input: 'new data default' },
      properties,
      ...(legacy ? updatedHooks : { lifetimes: updatedHooks }),
    })
    runtime.finishUpdate()
    const fresh = createHost()
    fresh.data.input = 'parent prop'
    fresh.properties = fresh.data
    definition!.lifetimes!.created!.call(fresh)
    fresh.data.input = 'parent prop'
    definition!.lifetimes!.attached!.call(fresh)
    expect(fresh.setData).toHaveBeenCalledWith({ count: 8 })
    expect(order).toEqual(['created', 'attached'])
  })

  it('tracks native pages without a user onLoad and restores replacement hosts during an update', () => {
    const runtime = createRuntime()
    const definition = runtime.bridge.Page({ data: { count: 0, input: '' } })
    const original = createHost()
    definition.onLoad!.call(original)
    original.data = { count: 2, input: 'held' }
    expect(runtime.instanceCount()).toBe(1)

    runtime.bridge.beginUpdate()
    definition.onUnload!.call(original)
    expect(runtime.instanceCount()).toBe(0)
    const replacement = createHost()
    definition.onLoad!.call(replacement)
    expect(replacement.setData).toHaveBeenCalledWith({ count: 2, input: 'held' })
    expect(replacement.data).toEqual({ count: 2, input: 'held' })
    expect(runtime.instanceCount()).toBe(1)
    runtime.finishUpdate()
  })

  it('suppresses user page lifecycle callbacks while still tracking and cleaning replacement hosts', () => {
    const runtime = createRuntime()
    const onLoad = vi.fn()
    const onUnload = vi.fn()
    const definition = runtime.bridge.Page({ onLoad, onUnload })
    const original = createHost()
    definition.onLoad!.call(original)
    original.data.count = 3
    runtime.bridge.beginUpdate()
    definition.onUnload!.call(original)
    const replacement = createHost()
    definition.onLoad!.call(replacement)
    expect(replacement.data.count).toBe(3)
    expect(onLoad).toHaveBeenCalledTimes(1)
    expect(onUnload).not.toHaveBeenCalled()
    expect(runtime.instanceCount()).toBe(1)
    runtime.finishUpdate()
    definition.onUnload!.call(replacement)
    expect(onUnload).toHaveBeenCalledTimes(1)
    expect(runtime.instanceCount()).toBe(0)
  })

  it('starts genuine page navigations with fresh state even when another instance is alive', () => {
    const runtime = createRuntime()
    const definition = runtime.bridge.Page({})
    const original = createHost()
    definition.onLoad!.call(original)
    original.data = { count: 4, input: 'previous route' }
    runtime.bridge.beginUpdate()
    runtime.finishUpdate()

    const nextPage = createHost()
    definition.onLoad!.call(nextPage)
    expect(nextPage.data).toEqual({ count: 0, input: '' })
    expect(nextPage.setData).not.toHaveBeenCalled()
    definition.onUnload!.call(original)
    definition.onUnload!.call(nextPage)
    const reopened = createHost()
    definition.onLoad!.call(reopened)
    expect(reopened.data).toEqual({ count: 0, input: '' })
    expect(runtime.instanceCount()).toBe(1)
  })

  it('keeps native component tracking and detach cleanup active during suppression', () => {
    const runtime = createRuntime()
    const attached = vi.fn()
    const detached = vi.fn()
    runtime.bridge.Component({ lifetimes: { attached, detached } })
    const [definition] = runtime.bridge.takeNativeDefinitions('Component')
    const original = createHost()
    definition!.lifetimes!.attached!.call(original)
    original.data.count = 1
    runtime.bridge.beginUpdate()
    definition!.lifetimes!.detached!.call(original)
    const replacement = createHost()
    definition!.lifetimes!.attached!.call(replacement)
    expect(replacement.data.count).toBe(1)
    expect(attached).toHaveBeenCalledTimes(1)
    expect(detached).not.toHaveBeenCalled()
    expect(runtime.instanceCount()).toBe(1)
    runtime.finishUpdate()
  })

  it('refreshes Wevu replacement hosts once before suppressed user lifecycle hooks', () => {
    const runtime = createRuntime()
    const created = vi.fn()
    const attached = vi.fn()
    const detached = vi.fn()
    const refresh = vi.fn((instance: HostInstance, snapshot?: HostInstance['data']) => {
      if (snapshot) {
        instance.setData(snapshot)
      }
    })
    const source = { data: { count: 0, input: '' }, lifetimes: { created, attached, detached } }
    const wevuDefinition = runtime.bridge.trackWevuComponent(source, refresh)
    runtime.bridge.Component(wevuDefinition)
    const [definition] = runtime.bridge.takeNativeDefinitions('Component')
    expect(definition).toBeDefined()
    const original = createHost()
    definition!.lifetimes!.created!.call(original)
    definition!.lifetimes!.attached!.call(original)
    original.data = { count: 2, input: 'held' }
    runtime.bridge.beginUpdate()
    runtime.bridge.trackWevuComponent(source, refresh)
    definition!.lifetimes!.detached!.call(original)
    expect(runtime.instanceCount()).toBe(0)
    const replacement = createHost()
    definition!.lifetimes!.created!.call(replacement)
    definition!.lifetimes!.attached!.call(replacement)

    expect(replacement.data).toEqual({ count: 2, input: 'held' })
    expect(refresh).toHaveBeenCalledTimes(2)
    expect(refresh).toHaveBeenLastCalledWith(replacement, { count: 2, input: 'held' })
    expect(created).toHaveBeenCalledTimes(1)
    expect(attached).toHaveBeenCalledTimes(1)
    expect(detached).not.toHaveBeenCalled()
    expect(runtime.instanceCount()).toBe(1)
    runtime.finishUpdate()

    definition!.lifetimes!.detached!.call(replacement)
    expect(detached).toHaveBeenCalledTimes(1)
    const nextPage = createHost()
    definition!.lifetimes!.created!.call(nextPage)
    definition!.lifetimes!.attached!.call(nextPage)
    expect(nextPage.data).toEqual({ count: 0, input: '' })
    expect(refresh).toHaveBeenLastCalledWith(nextPage, { count: 0, input: '' })
  })

  it('cleans Wevu page unloads during suppression and supplies missing component boundaries', () => {
    const runtime = createRuntime()
    const onUnload = vi.fn()
    const definition = runtime.bridge.trackWevuComponent({ onUnload }, vi.fn())
    const original = createHost()
    definition.lifetimes!.attached!.call(original)
    original.data.count = 5
    runtime.bridge.beginUpdate()
    definition.onUnload!.call(original)
    expect(runtime.instanceCount()).toBe(0)
    expect(onUnload).not.toHaveBeenCalled()
    const replacement = createHost()
    definition.lifetimes!.attached!.call(replacement)
    expect(replacement.data.count).toBe(5)
    definition.lifetimes!.detached!.call(replacement)
    expect(runtime.instanceCount()).toBe(0)
    runtime.finishUpdate()
  })
})
