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

    expect(inst.$wevu.state.props.title).toBe('')

    inst.properties.title = 'Hello'
    opts.observers.title.call(inst, 'Hello', '')
    await nextTick()

    expect(inst.$wevu.state.props.title).toBe('Hello')
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

    const initialRef = inst.$wevu.state.newProps
    expect(initialRef).toBeDefined()

    inst.properties.title = 'Hello'
    opts.observers.title.call(inst, 'Hello', '')
    await nextTick()

    expect(inst.$wevu.state.newProps).toBe(initialRef)
    expect(inst.$wevu.state.newProps.title).toBe('Hello')
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

    expect(inst.$wevu.state.props.title).toBe('Hello')
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

    expect(inst.$wevu.state.props.title).toBe('Hello')
    expect(inst.$wevu.state.props.subtitle).toBe('Sub')
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

    expect(inst.$wevu.state.props.title).toBe('Hello')
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

    expect(inst.$wevu.computed.boolText).toBe('false')

    inst.properties.bool = true
    opts.observers.bool.call(inst, true, false)
    await nextTick()

    expect(inst.$wevu.computed.boolText).toBe('true')
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({ boolText: 'true' }))
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

    expect(inst.$wevu.state.bool).toBe(true)
    expect(inst.$wevu.state.props.bool).toBe(true)

    inst.properties.bool = false
    opts.observers.bool.call(inst, false, true)
    await nextTick()

    expect(inst.$wevu.state.bool).toBe(false)
    expect(inst.$wevu.state.props.bool).toBe(false)

    const payloads = inst.setData.mock.calls.map(([payload]: any[]) => payload ?? {})
    expect(payloads.some(payload => Object.prototype.hasOwnProperty.call(payload, 'bool'))).toBe(false)
  })
})
