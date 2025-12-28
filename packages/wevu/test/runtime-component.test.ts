import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, onHide, onReady, onShow, onTabItemTap } from '@/index'

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
  it('attached/ready/detached + pageLifetimes show/hide + methods onTabItemTap', () => {
    const logs: string[] = []
    defineComponent({
      type: 'component',
      data: () => ({}),
      setup() {
        onReady(() => logs.push('ready'))
        onShow(() => logs.push('show'))
        onHide(() => logs.push('hide'))
        onTabItemTap(() => logs.push('tab'))
      },
      methods: {},
      lifetimes: {},
      pageLifetimes: {},
    })
    expect(registeredComponents).toHaveLength(1)
    const opts = registeredComponents[0]
    const inst: any = { setData() {} }
    // attach (mount runtime)
    opts.lifetimes.attached.call(inst)
    // ready
    opts.lifetimes.ready.call(inst)
    // page show/hide
    opts.pageLifetimes.show.call(inst)
    opts.pageLifetimes.hide.call(inst)
    // method wrapper
    if (typeof opts.methods.onTabItemTap === 'function') {
      opts.methods.onTabItemTap.call(inst)
    }
    // detach (teardown)
    opts.lifetimes.detached.call(inst)
    expect(logs).toEqual(['ready', 'show', 'hide', 'tab'])
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
