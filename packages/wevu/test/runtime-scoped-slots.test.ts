import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWevuScopedSlotComponent, defineComponent } from '@/index'
import { allocateOwnerId, getOwnerSnapshot, updateOwnerSnapshot } from '@/runtime/scopedSlots'

const registeredComponents: Record<string, any>[] = []

beforeEach(() => {
  registeredComponents.length = 0
  ;(globalThis as any).Component = vi.fn((options: Record<string, any>) => {
    registeredComponents.push(options)
  })
})

describe('runtime: scoped slots', () => {
  it('subscribes to owner snapshot and updates data', () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()
    expect(opts).toBeTruthy()

    const ownerId = allocateOwnerId()
    const proxy = { handle: vi.fn() }
    updateOwnerSnapshot(ownerId, { msg: 'hello' }, proxy as any)

    const inst: any = {
      properties: { __wvOwnerId: ownerId },
      setData: vi.fn(),
    }
    opts.lifetimes.attached.call(inst)
    expect(inst.__wvOwnerProxy).toBe(proxy)
    expect(inst.setData).toHaveBeenCalledWith({ __wvOwner: { msg: 'hello' } })

    inst.setData.mockClear()
    updateOwnerSnapshot(ownerId, { msg: 'next' }, proxy as any)
    expect(inst.setData).toHaveBeenCalledWith({ __wvOwner: { msg: 'next' } })

    opts.lifetimes.detached.call(inst)
    inst.setData.mockClear()
    updateOwnerSnapshot(ownerId, { msg: 'after' }, proxy as any)
    expect(inst.setData).not.toHaveBeenCalled()
  })

  it('merges slot scope into slot props', () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()
    expect(opts).toBeTruthy()

    const inst: any = {
      properties: { __wvSlotScope: { a: 1 }, __wvSlotProps: { b: 2 } },
      setData: vi.fn(),
    }

    const slotPropsObserver = opts.properties.__wvSlotProps.observer
    const slotScopeObserver = opts.properties.__wvSlotScope.observer
    slotPropsObserver.call(inst, { b: 2 })
    expect(inst.setData).toHaveBeenCalledWith({ __wvSlotPropsData: { a: 1, b: 2 } })

    inst.setData.mockClear()
    slotScopeObserver.call(inst, { a: 3 })
    expect(inst.setData).toHaveBeenCalledWith({ __wvSlotPropsData: { a: 3, b: 2 } })
  })

  it('supports array-based slot bindings', () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()
    expect(opts).toBeTruthy()

    const inst: any = {
      properties: {
        __wvSlotScope: ['scope', 1],
        __wvSlotProps: ['value', 2],
      },
      setData: vi.fn(),
    }

    const slotPropsObserver = opts.properties.__wvSlotProps.observer
    const slotScopeObserver = opts.properties.__wvSlotScope.observer
    slotPropsObserver.call(inst, ['value', 2])
    expect(inst.setData).toHaveBeenCalledWith({ __wvSlotPropsData: { scope: 1, value: 2 } })

    inst.setData.mockClear()
    slotScopeObserver.call(inst, ['scope', 3])
    expect(inst.setData).toHaveBeenCalledWith({ __wvSlotPropsData: { scope: 3, value: 2 } })
  })

  it('keeps slot prop observers on properties', () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()
    expect(opts).toBeTruthy()

    const propObserver = opts.properties.__wvSlotProps.observer
    const scopeObserver = opts.properties.__wvSlotScope.observer
    expect(typeof propObserver).toBe('function')
    expect(typeof scopeObserver).toBe('function')
    if (opts.observers?.__wvSlotProps) {
      expect(opts.observers.__wvSlotProps).not.toBe(propObserver)
    }
    if (opts.observers?.__wvSlotScope) {
      expect(opts.observers.__wvSlotScope).not.toBe(scopeObserver)
    }
  })

  it('exposes createWevuScopedSlotComponent on global', () => {
    const globalObject = globalThis as any
    expect(globalObject.__weapp_vite_createScopedSlotComponent).toBe(createWevuScopedSlotComponent)
  })

  it('reinstates global scoped slot creator when missing', () => {
    const globalObject = globalThis as any
    delete globalObject.__weapp_vite_createScopedSlotComponent

    defineComponent({
      setup() {
        return {}
      },
    })

    expect(globalObject.__weapp_vite_createScopedSlotComponent).toBe(createWevuScopedSlotComponent)
  })

  it('forwards events to owner handlers', () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()
    expect(opts).toBeTruthy()

    const handle = vi.fn()
    const inst: any = {
      __wvOwnerProxy: { handle },
      setData: vi.fn(),
      triggerEvent: vi.fn(),
      properties: {},
    }
    opts.lifetimes.created.call(inst)
    const event = {
      currentTarget: {
        dataset: {
          wvHandler: 'handle',
          wvArgs: '["ok","$event"]',
        },
      },
    }

    opts.methods.__weapp_vite_owner.call(inst, event)
    expect(handle).toHaveBeenCalledWith('ok', event)
  })

  it('forwards array args from dataset', () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()
    expect(opts).toBeTruthy()

    const handle = vi.fn()
    const inst: any = {
      __wvOwnerProxy: { handle },
      setData: vi.fn(),
      triggerEvent: vi.fn(),
      properties: {},
    }
    opts.lifetimes.created.call(inst)
    const event = {
      currentTarget: {
        dataset: {
          wvHandler: 'handle',
          wvArgs: ['ok', '$event'],
        },
      },
    }

    opts.methods.__weapp_vite_owner.call(inst, event)
    expect(handle).toHaveBeenCalledWith('ok', event)
  })

  it('forwards inline map expressions to owner handlers', () => {
    const inlineMap = {
      __wv_inline_0: {
        keys: ['name'],
        fn: (ctx: any, scope: Record<string, any>, evt: any) => ctx.handle(scope.name, evt.marker),
      },
    }
    createWevuScopedSlotComponent({ inlineMap })
    const opts = registeredComponents.pop()
    expect(opts).toBeTruthy()

    const handle = vi.fn()
    const inst: any = {
      __wvOwnerProxy: { handle },
      __wevu: { methods: { __weapp_vite_inline_map: inlineMap } },
      setData: vi.fn(),
      triggerEvent: vi.fn(),
      properties: {},
    }
    opts.lifetimes.created.call(inst)
    const event = {
      marker: 9,
      currentTarget: {
        dataset: {
          wvInlineId: '__wv_inline_0',
          wvS0: 'slot-name',
        },
      },
    }

    opts.methods.__weapp_vite_owner.call(inst, event)
    expect(handle).toHaveBeenCalledWith('slot-name', 9)
  })

  it('refreshes owner snapshot on prop changes', () => {
    defineComponent({
      props: {
        title: { type: String, default: '' },
      } as any,
      setup() {
        return {}
      },
    })

    const opts = registeredComponents.pop()
    expect(opts).toBeTruthy()

    const inst: any = { setData: vi.fn(), triggerEvent: vi.fn(), properties: { title: '' } }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    const ownerId = inst.__wvOwnerId
    expect(ownerId).toBeTruthy()
    expect(getOwnerSnapshot(ownerId)?.title).toBe('')

    inst.properties.title = 'Next'
    opts.observers.title.call(inst, 'Next', '')
    expect(getOwnerSnapshot(ownerId)?.title).toBe('Next')
  })
})
