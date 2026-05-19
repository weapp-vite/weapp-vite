import { WEVU_PUBLIC_RUNTIME_KEY } from '@weapp-core/constants'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from '@/index'

const registeredComponents: Record<string, any>[] = []

beforeEach(() => {
  registeredComponents.length = 0
  ;(globalThis as any).Component = vi.fn((options: Record<string, any>) => {
    registeredComponents.push(options)
  })
})

describe('runtime: props sync', () => {
  it('syncs mp properties changes into setup returned props binding', async () => {
    defineComponent({
      props: {
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
      } as any,
      setup(props, _ctx) {
        return { props }
      },
    })

    const opts = registeredComponents[0]
    expect(opts).toBeDefined()
    expect(opts.observers).toBeDefined()
    expect(typeof opts.observers.title).toBe('function')

    const inst: any = { setData: vi.fn(), triggerEvent: vi.fn(), properties: { title: '', subtitle: '' } }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)
    await nextTick()
    inst.setData.mockClear()

    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].state.props.title).toBe('')

    inst.properties.title = 'Hello'
    opts.observers.title.call(inst, 'Hello', '')
    await nextTick()

    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].state.props.title).toBe('Hello')
    expect(inst.setData).toHaveBeenCalledWith({ 'props.title': 'Hello' })
  })

  it('keeps props identity stable for aliased bindings', async () => {
    defineComponent({
      props: {
        title: { type: String, default: '' },
      } as any,
      setup(props, _ctx) {
        return { newProps: props }
      },
    })

    const opts = registeredComponents[0]
    const inst: any = { setData: vi.fn(), triggerEvent: vi.fn(), properties: { title: '' } }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)
    await nextTick()
    inst.setData.mockClear()

    const initialRef = inst[WEVU_PUBLIC_RUNTIME_KEY].state.newProps
    expect(initialRef).toBeDefined()

    inst.properties.title = 'Hello'
    opts.observers.title.call(inst, 'Hello', '')
    await nextTick()

    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].state.newProps).toBe(initialRef)
    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].state.newProps.title).toBe('Hello')
    expect(inst.setData).toHaveBeenCalledWith({ 'newProps.title': 'Hello' })
  })

  it('does not depend on this.properties being updated inside observers', async () => {
    defineComponent({
      props: {
        title: { type: String, default: '' },
      } as any,
      setup(props, _ctx) {
        return { props }
      },
    })

    const opts = registeredComponents[0]
    const inst: any = { setData: vi.fn(), triggerEvent: vi.fn(), properties: { title: '' } }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)
    await nextTick()
    inst.setData.mockClear()

    opts.observers.title.call(inst, 'Hello', '')
    await nextTick()

    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].state.props.title).toBe('Hello')
    expect(inst.setData).toHaveBeenCalledWith({ 'props.title': 'Hello' })
  })

  it('syncs latest properties on ready (late initial binding)', async () => {
    defineComponent({
      props: {
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
      } as any,
      setup(props, _ctx) {
        return { props }
      },
    })

    const opts = registeredComponents[0]
    const inst: any = { setData: vi.fn(), triggerEvent: vi.fn(), properties: { title: '', subtitle: '' } }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)
    await nextTick()
    inst.setData.mockClear()

    inst.properties.title = 'Hello'
    inst.properties.subtitle = 'Sub'
    opts.lifetimes.ready.call(inst)
    await nextTick()

    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].state.props.title).toBe('Hello')
    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].state.props.subtitle).toBe('Sub')
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({ 'props.title': 'Hello', 'props.subtitle': 'Sub' }))
  })

  it('syncs latest properties on attached even without observers', async () => {
    defineComponent({
      props: {
        title: { type: String, default: '' },
      } as any,
      setup(props, _ctx) {
        return { props }
      },
    })

    const opts = registeredComponents[0]
    const inst: any = { setData: vi.fn(), triggerEvent: vi.fn(), properties: { title: '' } }
    opts.lifetimes.created.call(inst)

    inst.properties.title = 'Hello'
    opts.lifetimes.attached.call(inst)
    await nextTick()

    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].state.props.title).toBe('Hello')
  })

  it('exposes __wevuProps on runtime proxy for compiled fallback expressions', async () => {
    defineComponent({
      props: {
        bool: { type: Boolean, default: false },
      } as any,
      setup() {
        return {}
      },
      computed: {
        boolText(this: any) {
          return String(this.__wevuProps?.bool)
        },
      },
    })

    const opts = registeredComponents[0]
    const inst: any = { setData: vi.fn(), triggerEvent: vi.fn(), properties: { bool: false } }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)
    await nextTick()
    inst.setData.mockClear()

    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].computed.boolText).toBe('false')

    inst.properties.bool = true
    opts.observers.bool.call(inst, true, false)
    await nextTick()

    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].computed.boolText).toBe('true')
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({ boolText: 'true' }))
  })

  it('exposes __wevuProps to computed bindings when component has no setup', async () => {
    defineComponent({
      props: {
        color: { type: String, default: '' },
        active: { type: Boolean, default: false },
      } as any,
      computed: {
        __wv_style_0(this: any) {
          return `color: ${this.__wevuProps?.color ?? ''}`
        },
        __wv_cls_0(this: any) {
          return this.__wevuProps?.active ? 'is-active' : ''
        },
      },
    })

    const opts = registeredComponents[0]
    const inst: any = { setData: vi.fn(), triggerEvent: vi.fn(), properties: { color: 'red', active: false } }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)
    await nextTick()
    inst.setData.mockClear()

    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].computed.__wv_style_0).toBe('color: red')
    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].computed.__wv_cls_0).toBe('')

    inst.properties.color = 'blue'
    inst.properties.active = true
    opts.observers.color.call(inst, 'blue', 'red')
    opts.observers.active.call(inst, true, false)
    await nextTick()

    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].computed.__wv_style_0).toBe('color: blue')
    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].computed.__wv_cls_0).toBe('is-active')
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      __wv_cls_0: 'is-active',
      __wv_style_0: 'color: blue',
    }))
  })

  it('maps setup bindings that collide with prop keys to live __wevuProps values', async () => {
    defineComponent({
      props: {
        bool: { type: Boolean, default: false },
      } as any,
      setup(props, _ctx) {
        const { bool } = props as any
        return { props, bool }
      },
    })

    const opts = registeredComponents[0]
    const inst: any = { setData: vi.fn(), triggerEvent: vi.fn(), properties: { bool: true } }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)
    await nextTick()
    inst.setData.mockClear()

    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].state.bool).toBe(true)
    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].state.props.bool).toBe(true)

    inst.properties.bool = false
    opts.observers.bool.call(inst, false, true)
    await nextTick()

    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].state.bool).toBe(false)
    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].state.props.bool).toBe(false)

    const payloads = inst.setData.mock.calls.map(([payload]: any[]) => payload ?? {})
    expect(payloads.some((payload: any) => Object.hasOwn(payload, 'bool'))).toBe(false)
  })

  it('syncs function props into setup props when declared as Function', async () => {
    const callback = vi.fn(() => 'ok')
    defineComponent({
      props: {
        callback: Function,
      } as any,
      setup(props) {
        return { props }
      },
    })

    const opts = registeredComponents[0]
    expect(opts.properties.callback.type).toBe(Function)

    const inst: any = { setData: vi.fn(), triggerEvent: vi.fn(), properties: { callback } }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)
    await nextTick()

    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].state.props.callback).toBe(callback)
    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].state.props.callback()).toBe('ok')
    expect(callback).toHaveBeenCalledTimes(1)
  })
})
