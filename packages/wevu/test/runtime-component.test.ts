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
  it('attached/ready/moved/error/detached + pageLifetimes show/hide/resize + methods onTabItemTap', () => {
    const logs: string[] = []
    defineComponent({
      data: () => ({}),
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
    // 方法包装
    if (typeof opts.methods.onTabItemTap === 'function') {
      opts.methods.onTabItemTap.call(inst)
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
})
