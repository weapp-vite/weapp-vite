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
})
