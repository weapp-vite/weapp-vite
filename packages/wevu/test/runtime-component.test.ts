import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, onError, onHide, onMoved, onReady, onResize, onShow, onTabItemTap } from '@/index'

const registeredComponents: Record<string, any>[] = []

beforeEach(() => {
  registeredComponents.length = 0
  ;(globalThis as any).Component = vi.fn((options: Record<string, any>) => {
    registeredComponents.push(options)
  })
})
afterEach(() => {
  delete (globalThis as any).Component
})

describe('runtime: component lifetimes/pageLifetimes mapping', () => {
  it('attached/ready/moved/error/detached + pageLifetimes show/hide/resize + onTabItemTap', () => {
    const logs: string[] = []
    defineComponent({
      data: () => ({}),
      onTabItemTap() {},
      setup() {
        onReady(() => logs.push('ready'))
        onShow(() => logs.push('show'))
        onHide(() => logs.push('hide'))
        onMoved(() => logs.push('moved'))
        onResize(() => logs.push('resize'))
        onError(() => logs.push('error'))
        onTabItemTap(() => logs.push('tab'))
      },
      methods: {},
      lifetimes: {},
      pageLifetimes: {},
    })
    expect(registeredComponents).toHaveLength(1)
    const opts = registeredComponents[0]
    const inst: any = { setData() {} }
    // 生命周期：attach（挂载 runtime）
    opts.lifetimes.attached.call(inst)
    // 生命周期：ready（就绪）
    opts.lifetimes.ready.call(inst)
    // 生命周期：moved / error（移动/错误）
    opts.lifetimes.moved.call(inst)
    opts.lifetimes.error.call(inst, new Error('boom'))
    // 页面 show/hide
    opts.pageLifetimes.show.call(inst)
    opts.pageLifetimes.hide.call(inst)
    opts.pageLifetimes.resize.call(inst)
    // tab
    if (typeof opts.onTabItemTap === 'function') {
      opts.onTabItemTap.call(inst, { index: 0, pagePath: '', text: '' })
    }
    // 生命周期：detach（卸载/清理）
    opts.lifetimes.detached.call(inst)
    expect(logs).toEqual(['ready', 'moved', 'error', 'show', 'hide', 'resize', 'tab'])
  })

  it('enables multipleSlots by default for components', () => {
    defineComponent({
      data: () => ({}),
      setup() {
        return {}
      },
    })
    const opts = registeredComponents[0]
    expect(opts.options?.multipleSlots).toBe(true)
  })

  it('respects user options.multipleSlots override', () => {
    defineComponent({
      data: () => ({}),
      setup() {
        return {}
      },
      options: {
        multipleSlots: false,
        virtualHost: true,
      },
    })
    const opts = registeredComponents[0]
    expect(opts.options?.multipleSlots).toBe(false)
    expect(opts.options?.virtualHost).toBe(true)
  })

  it('auto exports ctx.expose result by default', () => {
    defineComponent({
      data: () => ({}),
      setup(_props, ctx) {
        ctx.expose({ a: 1 })
        return {}
      },
    })
    const opts = registeredComponents[0]
    expect(typeof opts.export).toBe('function')

    const inst: any = { setData() {} }
    opts.lifetimes.attached.call(inst)

    const exported = opts.export.call(inst)
    expect(exported).toEqual({ a: 1 })
  })

  it('merges ctx.expose result with user export() when both provided', () => {
    defineComponent({
      data: () => ({}),
      export() {
        return { b: 2, a: 0 }
      },
      setup(_props, ctx) {
        ctx.expose({ a: 1 })
        return {}
      },
    })
    const opts = registeredComponents[0]
    expect(typeof opts.export).toBe('function')

    const inst: any = { setData() {} }
    opts.lifetimes.attached.call(inst)

    const exported = opts.export.call(inst)
    expect(exported).toEqual({ a: 0, b: 2 })
  })

  it('runs setup in created and defers setData until attached', async () => {
    defineComponent({
      data: () => ({}),
      setup() {
        return {
          count: 1,
        }
      },
    })
    const opts = registeredComponents[0]
    const setData = vi.fn()
    const inst: any = { setData }

    opts.lifetimes.created.call(inst)
    await Promise.resolve()
    expect(setData).not.toHaveBeenCalled()

    opts.lifetimes.attached.call(inst)
    expect(setData).toHaveBeenCalled()
    expect(setData.mock.calls[0]?.[0]).toMatchObject({ count: 1 })
  })
})
