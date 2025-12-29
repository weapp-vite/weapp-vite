import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent } from '@/index'

describe('runtime: descriptors and bridging coverage', () => {
  it('computed proxy exposes keys and property descriptors', () => {
    const app = createApp({
      data: () => ({ n: 1 }),
      computed: {
        a(this: any) {
          return this.n + 1
        },
        b: {
          get(this: any) {
            return this.n * 2
          },
          set(this: any, v: number) {
            this.n = v / 2
          },
        },
      },
      methods: {
        ping() {
          return 'pong'
        },
      },
    })
    const inst = app.mount()
    const keys = Object.keys((inst.proxy as any).$computed)
    expect(keys.sort()).toEqual(['a', 'b'])
    // getOwnPropertyDescriptor via $computed
    const dA = Object.getOwnPropertyDescriptor((inst.proxy as any).$computed, 'a')
    expect(dA?.enumerable).toBe(true)
    expect(dA?.configurable).toBe(true)
    // public proxy getOwnPropertyDescriptor for writable computed
    const dw = Object.getOwnPropertyDescriptor(inst.proxy as any, 'b')
    expect(typeof dw?.get).toBe('function')
    expect(typeof (dw as any).set).toBe('function')
    // methods show as non-enumerable value property
    const dm = Object.getOwnPropertyDescriptor(inst.proxy as any, 'ping')
    expect(dm?.enumerable).toBe(false)
    expect(dm?.value).toBeTypeOf('function')
  })
})

describe('runtime: page method collision/priority and invalid watch skips', () => {
  const registeredComponents: any[] = []

  beforeEach(() => {
    registeredComponents.length = 0
    ;(globalThis as any).Component = vi.fn((options: any) => {
      registeredComponents.push(options)
    })
  })

  afterEach(() => {
    delete (globalThis as any).Component
  })

  it('when user method is also defined in options, runtime bound method is invoked; user stub not required', () => {
    const calls: string[] = []
    defineComponent({
      data: () => ({ n: 0 }),
      methods: {
        inc() {
          calls.push('user') // not invoked for pages; runtime method is bridged
          return 1
        },
      },
      setup() {
        return {
          inc(this: any) {
            this.n++
            calls.push('runtime')
            return 2
          },
        }
      },
    })
    expect(registeredComponents).toHaveLength(1)
    const componentOptions = registeredComponents[0]
    const inst: any = { setData() {} }
    componentOptions.lifetimes.attached.call(inst)
    const r = componentOptions.methods.inc.call(inst)
    expect(inst.$wevu!.state.n).toBe(1)
    expect(calls).toEqual(['runtime'])
    // runtime method return is used when no user method on options
    expect(r).toBe(2)
  })

  it('invalid/undefined watch descriptors are skipped (no stops stored)', () => {
    defineComponent({
      data: () => ({ n: 0 }),
      methods: {},
      watch: {
        // string points to non-existent method
        n: 'notExists',
        // invalid descriptor object
        a: {} as any,
      } as any,
      setup() {
        return {}
      },
    })
    expect(registeredComponents).toHaveLength(1)
    const componentOptions = registeredComponents[0]
    const inst: any = { setData() {} }
    componentOptions.lifetimes.attached.call(inst)
    // no __wevuWatchStops should be created
    expect(inst.__wevuWatchStops).toBeUndefined()
  })
})
