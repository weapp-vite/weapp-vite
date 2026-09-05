import type { WevuRuntimeBindingManifestV1 } from '@weapp-core/constants'
import {
  WEVU_BINDING_MANIFEST_KEY,
  WEVU_INLINE_HANDLER,
  WEVU_PUBLIC_RUNTIME_KEY,
  WEVU_SCOPED_SLOT_CREATOR_KEY,
  WEVU_SCOPED_SLOT_OWNER_REQUIRED_KEY,
  WEVU_SLOT_FUNCTION_TOKEN,
  WEVU_SLOT_OWNER_ID_KEY,
  WEVU_SLOT_OWNER_ID_PROP,
  WEVU_SLOT_OWNER_KEY,
  WEVU_SLOT_OWNER_PROXY_KEY,
  WEVU_SLOT_PROPS_DATA_KEY,
  WEVU_SLOT_PROPS_KEY,
  WEVU_SLOT_SCOPE_KEY,
} from '@weapp-core/constants'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWevuScopedSlotComponent, defineComponent, nextTick, ref } from '@/index'
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

  it('writes owner function props through nested setData paths', () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    const ownerId = allocateOwnerId()
    const queryFn = vi.fn(() => Promise.resolve(['foo', 'bar']))
    const nestedHandler = vi.fn()
    updateOwnerSnapshot(ownerId, {
      label: 'Result',
      queryFn,
      handlers: {
        nestedHandler,
        ignored: 'value',
      },
    }, { queryFn, handlers: { nestedHandler } } as any)

    const inst: any = {
      properties: { __wvOwnerId: ownerId },
      setData: vi.fn(),
    }
    opts.lifetimes.attached.call(inst)

    expect(inst.setData).toHaveBeenCalledWith({
      '__wvOwner': {
        label: 'Result',
        handlers: { ignored: 'value' },
      },
      '__wvOwner.queryFn': queryFn,
      '__wvOwner.handlers.nestedHandler': nestedHandler,
    })
  })

  it('does not publish equivalent owner snapshots repeatedly', () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    const ownerId = allocateOwnerId()
    const proxy = { marker: 'owner' }
    updateOwnerSnapshot(ownerId, { list: [{ label: 'one' }] }, proxy as any)

    const inst: any = {
      properties: { __wvOwnerId: ownerId },
      setData: vi.fn(),
    }
    opts.lifetimes.attached.call(inst)
    inst.setData.mockClear()

    updateOwnerSnapshot(ownerId, { list: [{ label: 'one' }] }, proxy as any)
    expect(inst.setData).not.toHaveBeenCalled()

    updateOwnerSnapshot(ownerId, { list: [{ label: 'two' }] }, proxy as any)
    expect(inst.setData).toHaveBeenCalledTimes(1)
    expect(inst.setData).toHaveBeenCalledWith({
      __wvOwner: { list: [{ label: 'two' }] },
    })

    inst.setData.mockClear()
    const nextProxy = { marker: 'next-owner' }
    updateOwnerSnapshot(ownerId, { list: [{ label: 'two' }] }, nextProxy as any)
    expect(inst.setData).not.toHaveBeenCalled()
    expect(inst[WEVU_SLOT_OWNER_PROXY_KEY]).toBe(nextProxy)
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
      [WEVU_SCOPED_SLOT_OWNER_REQUIRED_KEY]: true,
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

  it('flushes owner id and template slot bindings over native placeholder data in patch mode', async () => {
    defineComponent({
      data: () => ({
        [WEVU_SLOT_OWNER_ID_KEY]: '',
        __wv_bind_0: null,
      }),
      computed: {
        __wv_bind_0() {
          return ['io', 1]
        },
      },
      setup() {
        return {}
      },
      setData: {
        pick: [WEVU_SLOT_OWNER_ID_KEY, '__wv_bind_0'],
        strategy: 'patch',
      },
    } as any)

    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const inst: any = {
      data: typeof opts.data === 'function' ? opts.data() : {},
      setData: vi.fn(),
    }
    opts.lifetimes.attached.call(inst)
    await nextTick()

    const payloads = inst.setData.mock.calls.map(([payload]: any[]) => payload ?? {})
    expect(payloads).not.toContainEqual(expect.objectContaining({
      [WEVU_SLOT_OWNER_ID_KEY]: '',
    }))
    expect(payloads).toContainEqual(expect.objectContaining({
      [WEVU_SLOT_OWNER_ID_KEY]: expect.stringMatching(/^wv\d+$/),
      __wv_bind_0: ['io', 1],
    }))
    expect(inst.data[WEVU_SLOT_OWNER_ID_KEY]).toMatch(/^wv\d+$/)
    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].proxy[WEVU_SLOT_OWNER_ID_KEY]).toBe(inst.data[WEVU_SLOT_OWNER_ID_KEY])
    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].proxy.__wv_bind_0).toEqual(['io', 1])
  })

  it('predeclares regular component owner id in native initial data without sharing owner ids', () => {
    defineComponent({
      computed: {
        __wv_bind_0() {
          return { default: true }
        },
      },
      setData: {
        pick: [WEVU_SLOT_OWNER_ID_KEY, '__wv_bind_0'],
        strategy: 'patch',
      },
    } as any)

    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()
    expect(opts.data[WEVU_SLOT_OWNER_ID_KEY]).toBe('')
    expect(opts.data.__wv_bind_0).toEqual({ default: true })

    const first: any = {
      data: { ...opts.data },
      setData: vi.fn(),
    }
    const second: any = {
      data: { ...opts.data },
      setData: vi.fn(),
    }
    opts.lifetimes.attached.call(first)
    opts.lifetimes.attached.call(second)

    expect(first.data[WEVU_SLOT_OWNER_ID_KEY]).toMatch(/^wv\d+$/)
    expect(second.data[WEVU_SLOT_OWNER_ID_KEY]).toMatch(/^wv\d+$/)
    expect(first.data[WEVU_SLOT_OWNER_ID_KEY]).not.toBe(second.data[WEVU_SLOT_OWNER_ID_KEY])
    expect(first.setData).toHaveBeenCalledWith({
      [WEVU_SLOT_OWNER_ID_KEY]: first.data[WEVU_SLOT_OWNER_ID_KEY],
    })
    expect(second.setData).toHaveBeenCalledWith({
      [WEVU_SLOT_OWNER_ID_KEY]: second.data[WEVU_SLOT_OWNER_ID_KEY],
    })
  })

  it('declares page owner data from the binding manifest without exposing compiler metadata', () => {
    const bindingManifest: WevuRuntimeBindingManifestV1 = {
      version: 1,
      sourceFile: 'src/pages/scoped-host.vue',
      bindings: [
        {
          id: 'binding:slot-owner',
          outputPath: WEVU_SLOT_OWNER_ID_KEY,
          sourceRoots: [WEVU_SLOT_OWNER_ID_KEY],
        },
      ],
      features: {
        scopedSlots: true,
      },
    }
    const definition = defineComponent({
      [WEVU_BINDING_MANIFEST_KEY]: bindingManifest,
      __wevu_isPage: true,
      data: () => ({
        tick: 0,
      }),
      setData: {
        strategy: 'patch',
      },
    })

    const opts = registeredComponents.pop()!

    expect(opts.data[WEVU_SLOT_OWNER_ID_KEY]).toMatch(/^wv\d+$/)
    expect(definition.__wevu_options.bindingManifest).toBe(bindingManifest)
    expect(opts).not.toHaveProperty(WEVU_BINDING_MANIFEST_KEY)
  })

  it('accepts scoped-slot manifest overrides without forwarding them to native options', () => {
    const bindingManifest: WevuRuntimeBindingManifestV1 = {
      version: 1,
      sourceFile: 'src/components/scoped-child.vue',
      bindings: [
        {
          id: 'binding:scoped-owner',
          outputPath: WEVU_SLOT_OWNER_ID_KEY,
          sourceRoots: [WEVU_SLOT_OWNER_ID_KEY],
          updateMode: 'top-level',
        },
      ],
      features: {
        scopedSlots: true,
      },
    }

    createWevuScopedSlotComponent({
      [WEVU_BINDING_MANIFEST_KEY]: bindingManifest,
    })
    const opts = registeredComponents.pop()!

    expect(opts.data[WEVU_SLOT_OWNER_ID_KEY]).toBe('')
    expect(opts).not.toHaveProperty(WEVU_BINDING_MANIFEST_KEY)
  })

  it('seeds page slot owner id and static slot metadata in native initial data', () => {
    defineComponent({
      __wevu_isPage: true,
      data: () => ({
        tick: 0,
      }),
      computed: {
        __wv_bind_0() {
          return { default: true }
        },
      },
      setData: {
        pick: [WEVU_SLOT_OWNER_ID_KEY, '__wv_bind_0', 'tick'],
        strategy: 'patch',
      },
    } as any)

    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()
    expect(opts.data[WEVU_SLOT_OWNER_ID_KEY]).toMatch(/^wv\d+$/)
    expect(opts.data.__wv_bind_0).toEqual({ default: true })

    const inst: any = {
      data: { ...opts.data },
      route: 'pages/issue-642-bug7/index',
      setData: vi.fn(),
    }
    opts.lifetimes.attached.call(inst)

    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].state[WEVU_SLOT_OWNER_ID_KEY]).toBe(opts.data[WEVU_SLOT_OWNER_ID_KEY])
    expect(inst[WEVU_PUBLIC_RUNTIME_KEY].proxy[WEVU_SLOT_OWNER_ID_KEY]).toBe(opts.data[WEVU_SLOT_OWNER_ID_KEY])
  })

  it('uses diff setData for explicit scoped slot host components in performance patch defaults', () => {
    const definition = defineComponent({
      properties: {
        [WEVU_SLOT_OWNER_ID_PROP]: {
          type: String,
          value: '',
        },
        [WEVU_SLOT_SCOPE_KEY]: {
          type: null,
          value: null,
        },
      },
      setData: {
        pick: [WEVU_SLOT_OWNER_ID_PROP, WEVU_SLOT_SCOPE_KEY, 'vueSlots'],
        strategy: 'patch',
      },
    } as any) as any

    expect(definition.__wevu_options.setData.strategy).toBe('diff')
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

  it('restores owner-proxy computed bindings when owner id arrives before attach', () => {
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
      properties: { [WEVU_SLOT_OWNER_ID_PROP]: ownerId },
      setData: vi.fn(),
    }
    opts.properties[WEVU_SLOT_OWNER_ID_PROP].observer.call(inst, ownerId)
    opts.lifetimes.attached.call(inst)

    expect(inst.__wevu.state[WEVU_SLOT_OWNER_PROXY_KEY]).toEqual(proxy)
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      __wv_bind_0: '987654321',
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

  it('keeps repeated equivalent slot bindings from scheduling native updates', async () => {
    const computed = {
      __wv_bind_0(this: any) {
        return this.__wvSlotPropsData.item
      },
    }
    createWevuScopedSlotComponent({ computed })
    const opts = registeredComponents.pop()!
    const ownerId = allocateOwnerId()
    const proxy = { cityList: [[{ name: 'Shanghai' }]] }
    updateOwnerSnapshot(ownerId, { cityList: [[{ name: 'Shanghai' }]] }, proxy as any)
    const scope = ['item', [{ name: 'Shanghai' }], 'index', 0]
    const inst: any = {
      data: typeof opts.data === 'function' ? opts.data() : {},
      properties: {
        [WEVU_SLOT_OWNER_ID_PROP]: ownerId,
        [WEVU_SLOT_PROPS_KEY]: [],
        [WEVU_SLOT_SCOPE_KEY]: scope,
      },
      setData: vi.fn(),
    }
    opts.lifetimes.attached.call(inst)
    const initialRuntimeScope = inst.__wevu.state[WEVU_SLOT_SCOPE_KEY]
    inst.setData.mockClear()

    for (let index = 0; index < 10; index++) {
      const equivalentScope = ['item', [{ name: 'Shanghai' }], 'index', 0]
      inst.properties[WEVU_SLOT_SCOPE_KEY] = equivalentScope
      opts.properties[WEVU_SLOT_SCOPE_KEY].observer.call(inst, equivalentScope)
      opts.observers[WEVU_SLOT_SCOPE_KEY].call(inst, equivalentScope)
      opts.properties[WEVU_SLOT_OWNER_ID_PROP].observer.call(inst, ownerId)
      opts.observers[WEVU_SLOT_OWNER_ID_PROP].call(inst, ownerId)
    }
    await nextTick()

    expect(inst.setData).not.toHaveBeenCalled()
    expect(inst.__wevu.state[WEVU_SLOT_SCOPE_KEY]).toBe(initialRuntimeScope)

    const changedScope = ['item', [{ name: 'Beijing' }], 'index', 0]
    inst.properties[WEVU_SLOT_SCOPE_KEY] = changedScope
    opts.properties[WEVU_SLOT_SCOPE_KEY].observer.call(inst, changedScope)
    expect(inst.setData).toHaveBeenCalledWith({
      [WEVU_SLOT_PROPS_DATA_KEY]: { item: [{ name: 'Beijing' }], index: 0 },
    })
    expect(inst.setData).toHaveBeenCalledWith({
      __wv_bind_0: [{ name: 'Beijing' }],
    })
  })

  it('reconstructs function-valued slot props through the provider inline bridge', () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    const inlineHandler = vi.fn(event => event.detail)
    const provider = { [WEVU_INLINE_HANDLER]: inlineHandler }
    const descriptor = [WEVU_SLOT_FUNCTION_TOKEN, 'i3', ['row'], [2]]
    const inst: any = {
      properties: {
        __wvSlotScope: null,
        __wvSlotProps: ['confirm', descriptor],
      },
      selectOwnerComponent: () => provider,
      setData: vi.fn(),
    }

    opts.lifetimes.attached.call(inst)
    const confirm = inst[WEVU_SLOT_PROPS_DATA_KEY].confirm

    expect(confirm('accepted')).toEqual(['accepted'])
    expect(inlineHandler).toHaveBeenCalledWith(expect.objectContaining({
      currentTarget: {
        dataset: {
          wd: 1,
          wi: 'i3',
          wvI0: 2,
          wvS0: 'row',
        },
      },
      detail: ['accepted'],
    }))
    expect(inst.setData).toHaveBeenCalledWith({
      [WEVU_SLOT_PROPS_DATA_KEY]: { confirm: descriptor },
    })
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

  it('restores native slot props data when slot props arrive before attach', () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const inst: any = {
      data: typeof opts.data === 'function' ? opts.data() : {},
      properties: {
        [WEVU_SLOT_SCOPE_KEY]: null,
        [WEVU_SLOT_PROPS_KEY]: ['item', { label: 'alpha' }, 'index', 0],
      },
      setData: vi.fn(),
    }
    opts.properties[WEVU_SLOT_PROPS_KEY].observer.call(inst, inst.properties[WEVU_SLOT_PROPS_KEY])
    inst.setData.mockClear()
    opts.lifetimes.attached.call(inst)

    expect(inst.setData).toHaveBeenCalledWith({
      [WEVU_SLOT_PROPS_DATA_KEY]: { item: { label: 'alpha' }, index: 0 },
    })
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

  it('writes scoped slot component refs back to the original owner', async () => {
    createWevuScopedSlotComponent({
      templateRefs: [
        { selector: '.__wevu-ref-0', inFor: false, name: 'leaf', kind: 'component' },
      ],
    })
    const opts = registeredComponents.pop()!
    const ownerId = allocateOwnerId()
    const leaf = { marker: 'scoped-leaf' }
    const leafRef = ref<any>(null)
    const owner: any = {
      __wevu: {
        state: {},
        proxy: {},
        setupState: { leaf: leafRef },
      },
    }
    updateOwnerSnapshot(ownerId, {}, owner.__wevu.proxy, owner)

    const inst: any = {
      data: typeof opts.data === 'function' ? opts.data() : {},
      properties: { [WEVU_SLOT_OWNER_ID_PROP]: ownerId },
      selectComponent: vi.fn(() => leaf),
      setData: vi.fn(),
    }
    opts.lifetimes.attached.call(inst)
    opts.lifetimes.ready.call(inst)
    await nextTick()
    await nextTick()

    expect(leafRef.value.marker).toBe('scoped-leaf')
    expect(owner.__wevu.state.$refs.leaf).toBeUndefined()

    opts.lifetimes.detached.call(inst)
    expect(leafRef.value).toBeNull()
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

  it('exposes a callable scoped slot creator on global', () => {
    createWevuScopedSlotComponent()
    const globalCreator = Reflect.get(globalThis, WEVU_SCOPED_SLOT_CREATOR_KEY)
    const registeredCount = registeredComponents.length

    expect(typeof globalCreator).toBe('function')
    if (typeof globalCreator !== 'function') {
      throw new TypeError('expected scoped slot creator')
    }
    globalCreator()
    expect(registeredComponents).toHaveLength(registeredCount + 1)
  })

  it('reinstates global scoped slot creator when missing', () => {
    createWevuScopedSlotComponent()
    const expectedCreator = Reflect.get(globalThis, WEVU_SCOPED_SLOT_CREATOR_KEY)
    Reflect.deleteProperty(globalThis, WEVU_SCOPED_SLOT_CREATOR_KEY)

    defineComponent({
      setup() {
        return {}
      },
    })

    expect(Reflect.get(globalThis, WEVU_SCOPED_SLOT_CREATOR_KEY)).toBe(expectedCreator)
  })

  it('refreshes stale global scoped slot creator', () => {
    createWevuScopedSlotComponent()
    const expectedCreator = Reflect.get(globalThis, WEVU_SCOPED_SLOT_CREATOR_KEY)
    Reflect.set(globalThis, WEVU_SCOPED_SLOT_CREATOR_KEY, vi.fn())

    defineComponent({
      setup() {
        return {}
      },
    })

    expect(Reflect.get(globalThis, WEVU_SCOPED_SLOT_CREATOR_KEY)).toBe(expectedCreator)
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
      [WEVU_SCOPED_SLOT_OWNER_REQUIRED_KEY]: true,
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
      [WEVU_SCOPED_SLOT_OWNER_REQUIRED_KEY]: true,
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

  it('does not publish scoped slot bridge state as nested owner snapshot', () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const upstreamOwnerId = allocateOwnerId()
    updateOwnerSnapshot(upstreamOwnerId, { list: [{ label: 'one' }] }, { list: [{ label: 'one' }] } as any)

    const inst: any = {
      data: typeof opts.data === 'function' ? opts.data() : {},
      properties: {
        [WEVU_SLOT_OWNER_ID_PROP]: upstreamOwnerId,
        [WEVU_SLOT_PROPS_KEY]: [],
        [WEVU_SLOT_SCOPE_KEY]: ['item', { label: 'one' }],
      },
      setData: vi.fn(),
      triggerEvent: vi.fn(),
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    const snapshot = getOwnerSnapshot(inst[WEVU_SLOT_OWNER_ID_KEY])
    expect(snapshot).toBeTruthy()
    expect(snapshot).not.toHaveProperty(WEVU_SLOT_OWNER_ID_KEY)
    expect(snapshot).not.toHaveProperty(WEVU_SLOT_OWNER_ID_PROP)
    expect(snapshot).not.toHaveProperty(WEVU_SLOT_OWNER_KEY)
    expect(snapshot).not.toHaveProperty(WEVU_SLOT_OWNER_PROXY_KEY)
    expect(snapshot).not.toHaveProperty(WEVU_SLOT_PROPS_DATA_KEY)
    expect(snapshot).not.toHaveProperty(WEVU_SLOT_PROPS_KEY)
    expect(snapshot).not.toHaveProperty(WEVU_SLOT_SCOPE_KEY)
    expect(inst.setData).toHaveBeenCalledWith({ [WEVU_SLOT_OWNER_KEY]: { list: [{ label: 'one' }] } })
    expect(inst.setData).toHaveBeenCalledWith({ [WEVU_SLOT_PROPS_DATA_KEY]: { item: { label: 'one' } } })
  })
})
