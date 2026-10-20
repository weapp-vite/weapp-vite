import type { Hook, HostInstance } from './runtimeTestHost'
import { describe, expect, it, vi } from 'vitest'
import { createHost, createRuntime } from './runtimeTestHost'

describe('stateful HMR native lifecycle defaults', () => {
  it('preserves existing page state when another facade first invokes a method after an update', () => {
    const runtime = createRuntime()
    const definition = runtime.bridge.Page({ data: { count: 0, input: '' }, onLoad() {}, increment() {} })
    const lifecycleReceiver = createHost()
    definition.onLoad!.call(lifecycleReceiver)
    lifecycleReceiver.data = { count: 4, input: 'user value' }
    // 宿主可为同一个已存在页面暴露另一个接收者；普通方法的首次调用不是页面创建。
    const facade = createHost()
    facade.data = { ...lifecycleReceiver.data }
    const expected = { ...facade.data }
    let observed: HostInstance['data'] | undefined
    const latestMethod = vi.fn(function (this: HostInstance) {
      observed = { ...this.data }
    })
    runtime.bridge.beginUpdate()
    runtime.bridge.Page({ data: { count: 7, input: 'updated' }, increment: latestMethod })
    runtime.finishUpdate()

    definition.increment!.call(facade)

    expect(observed).toEqual(expected)
    expect(facade.data).toEqual(expected)
    expect(facade.setData).not.toHaveBeenCalled()
    expect(lifecycleReceiver.data).toEqual(expected)
    expect(latestMethod).toHaveBeenCalledTimes(1)
    expect(runtime.instanceCount()).toBe(1)
    definition.onUnload!.call(lifecycleReceiver)
    expect(runtime.instanceCount()).toBe(0)
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
    expect(runtime.instanceCount()).toBe(1)
    expect(nextPage.data).toEqual({ count: 0, input: '' })
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

  it('keeps facade methods from owning a replacement snapshot', () => {
    const runtime = createRuntime()
    const definition = runtime.bridge.Page({ onLoad() {}, increment() {} })
    const owner = createHost()
    definition.onLoad!.call(owner)
    owner.data = { count: 4, input: 'owner state' }
    runtime.bridge.beginUpdate()
    runtime.bridge.Page({ data: { count: 7, input: 'updated' }, increment() {} })
    runtime.finishUpdate()
    const facade = createHost()
    facade.data = { count: 99, input: 'facade state' }
    definition.increment!.call(facade)
    expect(runtime.instanceCount()).toBe(1)

    runtime.bridge.beginUpdate()
    definition.onUnload!.call(owner)
    const replacement = createHost()
    definition.onLoad!.call(replacement)
    expect(replacement.data).toEqual({ count: 4, input: 'owner state' })
    expect(runtime.instanceCount()).toBe(1)
    runtime.finishUpdate()
    definition.onUnload!.call(replacement)
    expect(runtime.instanceCount()).toBe(0)
  })

  it('uses current defaults for each new lifecycle on a reused page receiver', () => {
    const runtime = createRuntime()
    const definition = runtime.bridge.Page({ data: { count: 0, input: '' } })
    const host = createHost()
    definition.onLoad!.call(host)
    host.data = { count: 4, input: 'first page' }
    definition.onUnload!.call(host)
    runtime.bridge.beginUpdate()
    runtime.bridge.Page({ data: { count: 7, input: 'updated' } })
    runtime.finishUpdate()

    definition.onLoad!.call(host)

    expect(host.data).toEqual({ count: 7, input: 'updated' })
    expect(runtime.instanceCount()).toBe(1)
  })

  it('keeps component creation defaults fixed until attachment across an update', () => {
    const runtime = createRuntime()
    runtime.bridge.Component({ data: { count: 0, input: '' }, lifetimes: { created() {} }, methods: { increment() {} } })
    const [definition] = runtime.bridge.takeNativeDefinitions('Component')
    const host = createHost()
    definition!.methods!.increment!.call(host)
    expect(runtime.instanceCount()).toBe(0)
    definition!.lifetimes!.created!.call(host)
    host.data.count = 3
    runtime.bridge.beginUpdate()
    runtime.bridge.Component({ data: { count: 7, input: 'updated' }, lifetimes: { created() {} }, methods: { increment() {} } })
    runtime.finishUpdate()

    definition!.lifetimes!.attached!.call(host)

    expect(host.data).toEqual({ count: 3, input: '' })
    expect(host.setData).not.toHaveBeenCalled()
    expect(runtime.instanceCount()).toBe(1)
    definition!.lifetimes!.detached!.call(host)
    expect(runtime.instanceCount()).toBe(0)
  })

  it('keeps app method tracking and snapshot state unchanged', () => {
    const runtime = createRuntime()
    const initialMethod = vi.fn()
    const definition = runtime.bridge.App({ data: { count: 0, input: '' }, increment: initialMethod })
    const host = createHost()
    definition.increment!.call(host)
    host.data = { count: 4, input: 'app state' }
    const latestMethod = vi.fn(function (this: HostInstance) {
      this.data.count++
    })
    runtime.bridge.beginUpdate()
    runtime.bridge.App({ data: { count: 7, input: 'updated' }, increment: latestMethod })
    runtime.finishUpdate()

    definition.increment!.call(host)

    expect(host.data).toEqual({ count: 5, input: 'app state' })
    expect(initialMethod).toHaveBeenCalledTimes(1)
    expect(latestMethod).toHaveBeenCalledTimes(1)
    expect(runtime.instanceCount()).toBe(1)
  })
})
