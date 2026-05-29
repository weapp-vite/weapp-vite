import { WEVU_PUBLIC_RUNTIME_KEY, WEVU_SLOT_OWNER_ID_KEY, WEVU_SLOT_OWNER_ID_PROP, WEVU_SLOT_OWNER_PROXY_KEY } from '@weapp-core/constants'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWevuScopedSlotComponent, defineComponent, nextTick } from '@/index'
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
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()
    expect(opts.options?.virtualHost).toBe(true)

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

  it('keeps owner proxy available for computed bindings', () => {
    const computed = {
      __wv_bind_0(this: any) {
        try {
          return this[WEVU_SLOT_OWNER_PROXY_KEY].func(this[WEVU_SLOT_OWNER_PROXY_KEY].text)
        }
        catch {
          return undefined
        }
      },
    }
    createWevuScopedSlotComponent({ computed })
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerId = allocateOwnerId()
    const proxy = {
      text: '123456789',
      func: (text: string) => text.split('').reverse().join(''),
    }
    updateOwnerSnapshot(ownerId, { text: '123456789' }, proxy as any)

    const inst: any = {
      properties: { __wvOwnerId: ownerId },
      setData: vi.fn(),
    }
    opts.lifetimes.attached.call(inst)

    expect(inst.__wevu.state.__wvOwner).toEqual({ text: '123456789' })
    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].computed.__wv_bind_0).toBe('987654321')
    expect(inst.setData).toHaveBeenCalledWith({ __wvOwner: { text: '123456789' } })
  })

  it('flushes owner-proxy computed bindings after owner snapshot is attached', () => {
    const computed = {
      __wv_bind_0(this: any) {
        try {
          return this[WEVU_SLOT_OWNER_PROXY_KEY].func(this[WEVU_SLOT_OWNER_PROXY_KEY].text)
        }
        catch {
          return undefined
        }
      },
    }
    createWevuScopedSlotComponent({ computed })
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerId = allocateOwnerId()
    const proxy = {
      text: '123456789',
      func: (text: string) => text.split('').reverse().join(''),
    }
    updateOwnerSnapshot(ownerId, { text: '123456789' }, proxy as any)

    const inst: any = {
      data: typeof opts.data === 'function' ? opts.data() : {},
      properties: { __wvOwnerId: ownerId },
      setData: vi.fn(),
    }
    opts.lifetimes.attached.call(inst)

    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      __wv_bind_0: '987654321',
    }))
    expect(inst.setData).not.toHaveBeenCalledWith(expect.objectContaining({
      [WEVU_SLOT_OWNER_PROXY_KEY]: proxy,
    }))
    expect(inst.setData).not.toHaveBeenCalledWith(expect.objectContaining({
      [WEVU_SLOT_OWNER_ID_KEY]: ownerId,
    }))
  })

  it('keeps regular component owner id available for template runtime bindings', async () => {
    defineComponent({
      data: () => ({
        title: 'slot owner host',
      }),
      computed: {
        __wv_bind_0() {
          return { default: true }
        },
      },
    })
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const inst: any = {
      data: typeof opts.data === 'function' ? opts.data() : {},
      setData: vi.fn(),
    }
    opts.lifetimes.attached.call(inst)
    await nextTick()

    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      [WEVU_SLOT_OWNER_ID_KEY]: expect.any(String),
    }))
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      __wv_bind_0: { default: true },
    }))
  })

  it('binds owner-proxy computed bindings when owner id arrives after attach', () => {
    const computed = {
      __wv_bind_0(this: any) {
        try {
          return this[WEVU_SLOT_OWNER_PROXY_KEY].func(this[WEVU_SLOT_OWNER_PROXY_KEY].text)
        }
        catch {
          return undefined
        }
      },
    }
    createWevuScopedSlotComponent({ computed })
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerId = allocateOwnerId()
    const proxy = {
      text: '123456789',
      func: (text: string) => text.split('').reverse().join(''),
    }
    updateOwnerSnapshot(ownerId, { text: '123456789' }, proxy as any)

    const inst: any = {
      data: typeof opts.data === 'function' ? opts.data() : {},
      properties: { __wvOwnerId: '' },
      setData: vi.fn(),
    }
    opts.lifetimes.attached.call(inst)
    inst.setData.mockClear()

    inst.properties.__wvOwnerId = ownerId
    opts.properties.__wvOwnerId.observer.call(inst, ownerId)

    expect(inst.setData).toHaveBeenCalledWith({ __wvOwner: { text: '123456789' } })
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      __wv_bind_0: '987654321',
    }))
    expect(inst.setData).not.toHaveBeenCalledWith(expect.objectContaining({
      [WEVU_SLOT_OWNER_PROXY_KEY]: proxy,
    }))
  })

  it('binds owner-proxy computed bindings from dedicated owner id prop', () => {
    const computed = {
      __wv_bind_0(this: any) {
        try {
          return this[WEVU_SLOT_OWNER_PROXY_KEY].func(this[WEVU_SLOT_OWNER_PROXY_KEY].text)
        }
        catch {
          return undefined
        }
      },
    }
    createWevuScopedSlotComponent({ computed })
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerId = allocateOwnerId()
    const proxy = {
      text: '123456789',
      func: (text: string) => text.split('').reverse().join(''),
    }
    updateOwnerSnapshot(ownerId, { text: '123456789' }, proxy as any)

    const inst: any = {
      data: typeof opts.data === 'function' ? opts.data() : {},
      properties: {
        [WEVU_SLOT_OWNER_ID_KEY]: 'local-scoped-slot-owner',
        [WEVU_SLOT_OWNER_ID_PROP]: ownerId,
      },
      setData: vi.fn(),
    }
    opts.lifetimes.attached.call(inst)

    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      __wv_bind_0: '987654321',
    }))
  })

  it('does not register the legacy raw owner id attribute as a property', () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!

    expect(opts.properties).toHaveProperty(WEVU_SLOT_OWNER_ID_PROP)
    expect(opts.properties).toHaveProperty(WEVU_SLOT_OWNER_ID_KEY)
    expect(opts.properties).not.toHaveProperty('__wv-owner-id')
  })

  it('resyncs owner-proxy computed bindings on ready', () => {
    const computed = {
      __wv_bind_0(this: any) {
        try {
          return this[WEVU_SLOT_OWNER_PROXY_KEY].func(this[WEVU_SLOT_OWNER_PROXY_KEY].text)
        }
        catch {
          return undefined
        }
      },
    }
    createWevuScopedSlotComponent({ computed })
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerId = allocateOwnerId()
    const proxy = {
      text: '123456789',
      func: (text: string) => text.split('').reverse().join(''),
    }
    updateOwnerSnapshot(ownerId, { text: '123456789' }, proxy as any)

    const inst: any = {
      data: typeof opts.data === 'function' ? opts.data() : {},
      properties: {
        [WEVU_SLOT_OWNER_ID_PROP]: ownerId,
      },
      setData: vi.fn(),
    }
    opts.lifetimes.attached.call(inst)
    inst.setData.mockClear()
    opts.lifetimes.ready.call(inst)

    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      __wv_bind_0: '987654321',
    }))
  })

  it('stores owner proxy on scoped slot data without exposing it to snapshots', () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerId = allocateOwnerId()
    const proxy = {
      text: '123456789',
      func: (text: string) => text.split('').reverse().join(''),
    }
    updateOwnerSnapshot(ownerId, { text: '123456789' }, proxy as any)

    const data = typeof opts.data === 'function' ? opts.data() : {}
    const inst: any = {
      data,
      properties: { __wvOwnerId: ownerId },
      setData: vi.fn(),
    }
    opts.lifetimes.attached.call(inst)

    expect(inst.data[WEVU_SLOT_OWNER_PROXY_KEY]).toBe(proxy)
    expect(Object.keys(inst.data)).not.toContain(WEVU_SLOT_OWNER_PROXY_KEY)
    expect(inst.setData).not.toHaveBeenCalledWith(expect.objectContaining({
      [WEVU_SLOT_OWNER_PROXY_KEY]: proxy,
    }))
  })

  it('merges slot scope into slot props', () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
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
    const opts = registeredComponents.pop()!
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

  it('refreshes computed bindings after slot props change', () => {
    const computed = {
      __wv_bind_0(this: any) {
        return this.__wvSlotPropsData.label
      },
    }
    createWevuScopedSlotComponent({ computed })
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const inst: any = {
      data: typeof opts.data === 'function' ? opts.data() : {},
      properties: {
        __wvSlotScope: null,
        __wvSlotProps: ['label', 'alpha'],
      },
      setData: vi.fn(),
    }
    opts.lifetimes.attached.call(inst)

    expect(inst.__wevu.state.__wvSlotPropsData).toEqual({ label: 'alpha' })
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      __wv_bind_0: 'alpha',
    }))

    inst.setData.mockClear()
    opts.properties.__wvSlotProps.observer.call(inst, ['label', 'beta'])

    expect(inst.__wevu.state.__wvSlotPropsData).toEqual({ label: 'beta' })
    expect(inst.setData).toHaveBeenCalledWith({ __wvSlotPropsData: { label: 'beta' } })
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      __wv_bind_0: 'beta',
    }))
  })

  it('keeps slot props readable for computed bindings before attach', () => {
    const computed = {
      __wv_bind_0(this: any) {
        return this.__wvSlotPropsData.items.map((item: string) => item.toUpperCase())
      },
    }
    createWevuScopedSlotComponent({ computed })
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const inst: any = {
      data: typeof opts.data === 'function' ? opts.data() : {},
      properties: {
        __wvSlotScope: null,
        __wvSlotProps: ['items', ['alpha']],
      },
      setData: vi.fn(),
    }

    expect(() => {
      opts.properties.__wvSlotProps.observer.call(inst, ['items', ['alpha']])
    }).not.toThrow()
    expect(inst.__wvSlotPropsData).toEqual({ items: ['alpha'] })
    expect(inst.setData).toHaveBeenCalledWith({ __wvSlotPropsData: { items: ['alpha'] } })
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      __wv_bind_0: ['ALPHA'],
    }))
  })

  it('keeps slot props readable when owner id arrives before slot prop observers', () => {
    const computed = {
      __wv_bind_0(this: any) {
        return this.__wvSlotPropsData.items.map((item: string) => item.toUpperCase())
      },
    }
    createWevuScopedSlotComponent({ computed })
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerId = allocateOwnerId()
    updateOwnerSnapshot(ownerId, { ready: true }, { ready: true } as any)

    const inst: any = {
      data: typeof opts.data === 'function' ? opts.data() : {},
      properties: {
        __wvOwnerId: '',
        __wvSlotScope: null,
        __wvSlotProps: ['items', ['alpha']],
      },
      setData: vi.fn(),
    }

    expect(() => {
      opts.properties.__wvOwnerId.observer.call(inst, ownerId)
    }).not.toThrow()
    expect(inst.__wvSlotPropsData).toEqual({ items: ['alpha'] })
    expect(inst.__wvOwner).toEqual({ ready: true })
    expect(inst.setData).toHaveBeenCalledWith({ __wvOwner: { ready: true } })
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      __wv_bind_0: ['ALPHA'],
    }))
  })

  it('keeps slot prop observers on properties', () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
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

  it('refreshes stale global scoped slot creator', () => {
    const globalObject = globalThis as any
    globalObject.__weapp_vite_createScopedSlotComponent = vi.fn()

    defineComponent({
      setup() {
        return {}
      },
    })

    expect(globalObject.__weapp_vite_createScopedSlotComponent).toBe(createWevuScopedSlotComponent)
  })

  it('forwards events to owner handlers', () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
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
    const opts = registeredComponents.pop()!
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
    const opts = registeredComponents.pop()!
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

    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const inst: any = { data: {}, setData: vi.fn(), triggerEvent: vi.fn(), properties: { title: '' } }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    const ownerId = inst.__wvOwnerId
    expect(ownerId).toBeTruthy()
    expect(inst.data[WEVU_SLOT_OWNER_ID_KEY]).toBe(ownerId)
    expect(getOwnerSnapshot(ownerId)?.title).toBe('')

    inst.properties.title = 'Next'
    opts.observers.title.call(inst, 'Next', '')
    expect(getOwnerSnapshot(ownerId)?.title).toBe('Next')
  })

  it('stores owner snapshots as plain objects for view-layer compatibility', () => {
    defineComponent({
      props: {
        title: { type: String, default: '' },
      } as any,
      setup() {
        return {
          nested: {
            ok: true,
          },
        }
      },
    })

    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const inst: any = { setData: vi.fn(), triggerEvent: vi.fn(), properties: { title: 'demo' } }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    const ownerId = inst.__wvOwnerId
    const snapshot = getOwnerSnapshot(ownerId)
    expect(snapshot).toMatchObject({
      title: 'demo',
      nested: { ok: true },
    })
    expect(Object.getPrototypeOf(snapshot)).toBe(Object.prototype)
    expect(Object.getPrototypeOf(snapshot?.nested)).toBe(Object.prototype)
  })
})
