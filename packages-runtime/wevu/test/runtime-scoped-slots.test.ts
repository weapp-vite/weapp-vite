import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWevuScopedSlotComponent, defineComponent, ref, resetWevuDefaults, setWevuDefaults, unref } from '@/index'
import { allocateOwnerId, clearFallbackSlotOwnerId, getOwnerSnapshot, rememberSlotOwnerId, updateOwnerSnapshot } from '@/runtime/scopedSlots'
import { nextTick } from '@/scheduler'

const registeredComponents: Record<string, any>[] = []

beforeEach(() => {
  registeredComponents.length = 0
  clearFallbackSlotOwnerId()
  resetWevuDefaults()
  ;(globalThis as any).Component = vi.fn((options: Record<string, any>) => {
    registeredComponents.push(options)
  })
})

async function flushScopedSlotTimers(times = 3) {
  for (let i = 0; i < times; i += 1) {
    await new Promise(resolve => setTimeout(resolve, 0))
  }
}

describe('runtime: scoped slots', () => {
  it('subscribes to owner snapshot and updates data', async () => {
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
    await flushScopedSlotTimers(2)
    expect(inst.__wvOwnerProxy).toBe(proxy)
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      'wvslotowner.msg': 'hello',
      'wvslotownerpropmsg': 'hello',
    }))

    inst.setData.mockClear()
    updateOwnerSnapshot(ownerId, { msg: 'next' }, proxy as any)
    await flushScopedSlotTimers(1)
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      'wvslotowner.msg': 'next',
      'wvslotownerpropmsg': 'next',
    }))

    opts.lifetimes.detached.call(inst)
    inst.setData.mockClear()
    updateOwnerSnapshot(ownerId, { msg: 'after' }, proxy as any)
    await flushScopedSlotTimers(1)
    expect(inst.setData).not.toHaveBeenCalled()
  })

  it('ignores dashed owner id aliases in scoped slot native properties', () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerId = allocateOwnerId()
    const proxy = { handle: vi.fn() }
    updateOwnerSnapshot(ownerId, { msg: 'dashed' }, proxy as any)

    const inst: any = {
      properties: { '__wv-owner-id': ownerId },
      setData: vi.fn(),
    }
    opts.lifetimes.attached.call(inst)

    expect(inst.__wvOwnerProxy).toBeUndefined()
    expect(inst.setData).not.toHaveBeenCalledWith(expect.objectContaining({
      __wvOwner: { msg: 'dashed' },
    }))
  })

  it('accepts scoped slot owner id aliases from outlet props', async () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerId = allocateOwnerId()
    const proxy = { handle: vi.fn() }
    updateOwnerSnapshot(ownerId, { msg: 'prop-alias' }, proxy as any)

    const inst: any = {
      properties: { __wvSlotOwnerId: ownerId },
      setData: vi.fn(),
    }
    opts.lifetimes.attached.call(inst)

    await flushScopedSlotTimers(2)
    expect(inst.__wvOwnerProxy).toBe(proxy)
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({ 'wvslotowner.msg': 'prop-alias' }))
  })

  it('accepts scoped slot owner id from generic outlet props', async () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerId = allocateOwnerId()
    const proxy = { handle: vi.fn() }
    updateOwnerSnapshot(ownerId, { msg: 'generic-prop-alias' }, proxy as any)

    const inst: any = {
      properties: { wvSlotOwnerId: ownerId },
      setData: vi.fn(),
    }
    opts.lifetimes.attached.call(inst)

    await flushScopedSlotTimers(2)
    expect(inst.__wvOwnerProxy).toBe(proxy)
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({ 'wvslotowner.msg': 'generic-prop-alias' }))
  })

  it('accepts scoped slot owner id from lowercase generic outlet attrs', async () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerId = allocateOwnerId()
    const proxy = { handle: vi.fn() }
    updateOwnerSnapshot(ownerId, { msg: 'generic-attr-alias' }, proxy as any)

    const inst: any = {
      properties: { wvslotownerid: ownerId },
      setData: vi.fn(),
    }
    opts.lifetimes.attached.call(inst)

    await flushScopedSlotTimers(2)
    expect(inst.__wvOwnerProxy).toBe(proxy)
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({ 'wvslotowner.msg': 'generic-attr-alias' }))
  })

  it('ignores self owner id when generic owner id observers fire', async () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const pageOwnerId = allocateOwnerId()
    const proxy = { handle: vi.fn() }
    updateOwnerSnapshot(pageOwnerId, { msg: 'page-owner' }, proxy as any)

    const inst: any = {
      __wvOwnerId: 'self-owner',
      properties: { __wvOwnerId: 'self-owner', wvslotownerid: pageOwnerId },
      setData: vi.fn(),
    }
    opts.properties.__wvOwnerId.observer.call(inst, 'self-owner')
    opts.properties.wvslotownerid.observer.call(inst, pageOwnerId)
    opts.lifetimes.attached.call(inst)

    await flushScopedSlotTimers(2)
    expect(inst.__wvOwnerProxy).toBe(proxy)
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({ 'wvslotowner.msg': 'page-owner' }))
    expect(inst.setData).not.toHaveBeenCalledWith(expect.objectContaining({ 'wvslotowner.__wvOwnerProxy': undefined }))
  })

  it('merges generic slot scope into generic slot props', () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const inst: any = {
      properties: { wvSlotScope: ['scope', 1], wvSlotProps: ['value', 2] },
      setData: vi.fn(),
    }

    opts.properties.wvSlotProps.observer.call(inst, ['value', 2])
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      __wvSlotPropsData: { scope: 1, value: 2 },
      wvslotpropsdata: { scope: 1, value: 2 },
    }))

    inst.setData.mockClear()
    opts.properties.wvSlotScope.observer.call(inst, ['scope', 3])
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      __wvSlotPropsData: { scope: 3, value: 2 },
      wvslotpropsdata: { scope: 3, value: 2 },
    }))
  })

  it('syncs generic owner props from observer payload before properties update', () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const inst: any = {
      properties: {},
      setData: vi.fn(),
    }

    opts.properties.wvslotownerprops.observer.call(inst, ['value', 'ok'])
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      wvslotowner: { value: 'ok' },
      wvslotpropsdata: { value: 'ok' },
      wvslotownerpropvalue: 'ok',
    }))
  })

  it('keeps observer payload when lifecycle reads stale generic owner properties', async () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerId = allocateOwnerId()
    updateOwnerSnapshot(ownerId, {}, {} as any)

    const inst: any = {
      properties: { wvslotownerid: ownerId },
      setData: vi.fn(),
    }

    opts.properties.wvslotownerprops.observer.call(inst, ['value', 'ok'])
    inst.setData.mockClear()
    opts.lifetimes.attached.call(inst)
    await flushScopedSlotTimers(2)

    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      wvslotpropsdata: { value: 'ok' },
    }))
  })

  it('merges lowercase generic outlet attrs into generic slot props', () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const inst: any = {
      properties: { wvslotscope: ['scope', 1], wvslotprops: ['value', 2] },
      setData: vi.fn(),
    }

    opts.properties.wvslotprops.observer.call(inst, ['value', 2])
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      __wvSlotPropsData: { scope: 1, value: 2 },
      wvslotpropsdata: { scope: 1, value: 2 },
    }))

    inst.setData.mockClear()
    opts.properties.wvslotscope.observer.call(inst, ['scope', 3])
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      __wvSlotPropsData: { scope: 3, value: 2 },
      wvslotpropsdata: { scope: 3, value: 2 },
    }))
  })

  it('subscribes when scoped slot owner id arrives after attached', async () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerId = allocateOwnerId()
    const proxy = { handle: vi.fn() }
    updateOwnerSnapshot(ownerId, { msg: 'late-prop' }, proxy as any)

    const inst: any = {
      properties: { __wvSlotOwnerId: '' },
      setData: vi.fn(),
    }
    opts.lifetimes.attached.call(inst)
    expect(inst.setData).not.toHaveBeenCalledWith({ __wvOwner: { msg: 'late-prop' } })

    inst.properties.__wvSlotOwnerId = ownerId
    opts.properties.__wvSlotOwnerId.observer.call(inst, ownerId)

    await flushScopedSlotTimers(2)
    expect(inst.__wvOwnerProxy).toBe(proxy)
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({ 'wvslotowner.msg': 'late-prop' }))
  })

  it('keeps pending owner id when attached sees stale empty properties', async () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerId = allocateOwnerId()
    const proxy = { handle: vi.fn() }
    updateOwnerSnapshot(ownerId, { msg: 'observer-first' }, proxy as any)

    const inst: any = {
      properties: { __wvSlotOwnerId: '' },
      setData: vi.fn(),
    }
    opts.properties.__wvSlotOwnerId.observer.call(inst, ownerId)
    opts.lifetimes.attached.call(inst)

    await flushScopedSlotTimers(2)
    expect(inst.__wvOwnerProxy).toBe(proxy)
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({ 'wvslotowner.msg': 'observer-first' }))
  })

  it('resolves owner id from owner component data when scoped slot props are hidden', async () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerId = allocateOwnerId()
    const proxy = { handle: vi.fn() }
    updateOwnerSnapshot(ownerId, { msg: 'owner-component' }, proxy as any)

    const inst: any = {
      properties: {},
      setData: vi.fn(),
      selectOwnerComponent: () => ({
        data: { __wvOwnerId: ownerId },
      }),
    }
    opts.lifetimes.attached.call(inst)

    await flushScopedSlotTimers(2)
    expect(inst.__wvOwnerProxy).toBe(proxy)
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({ 'wvslotowner.msg': 'owner-component' }))
  })

  it('resolves owner id from lowercase owner component data alias', async () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerId = allocateOwnerId()
    const proxy = { handle: vi.fn() }
    updateOwnerSnapshot(ownerId, { msg: 'owner-data-alias' }, proxy as any)

    const inst: any = {
      properties: {},
      setData: vi.fn(),
      selectOwnerComponent: () => ({
        data: { wvslotownerid: ownerId },
      }),
    }
    opts.lifetimes.attached.call(inst)

    await flushScopedSlotTimers(2)
    expect(inst.__wvOwnerProxy).toBe(proxy)
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({ 'wvslotowner.msg': 'owner-data-alias' }))
  })

  it('resolves owner id from lowercase owner component properties alias', async () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerId = allocateOwnerId()
    const proxy = { handle: vi.fn() }
    updateOwnerSnapshot(ownerId, { msg: 'owner-properties-alias' }, proxy as any)

    const inst: any = {
      properties: {},
      setData: vi.fn(),
      selectOwnerComponent: () => ({
        properties: { wvslotownerid: ownerId },
      }),
    }
    opts.lifetimes.attached.call(inst)

    await flushScopedSlotTimers(2)
    expect(inst.__wvOwnerProxy).toBe(proxy)
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({ 'wvslotowner.msg': 'owner-properties-alias' }))
  })

  it('syncs owner component scoped slot props into native scoped slot data', () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerComponent = {
      data: {
        wvslotpropsdata: { value: 'ok', missing: undefined },
        wvslotownerprops: ['fromArray', 'array-value', 'skip', undefined],
        wvslotownerpropvalue: 'ok',
        wvslotownerpropwvslotbind0: '987654321',
        wvslotownerpropempty: undefined,
      },
      properties: {
        wvslotpropssource: { propValue: 'prop-ok' },
      },
    }
    const inst: any = {
      properties: {},
      setData: vi.fn(),
      selectOwnerComponent: () => ownerComponent,
    }

    opts.lifetimes.attached.call(inst)

    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      wvslotpropsdata: expect.objectContaining({
        value: 'ok',
        fromArray: 'array-value',
        propValue: 'prop-ok',
        wvslotbind0: '987654321',
      }),
      wvslotownerpropvalue: 'ok',
      wvslotownerpropwvslotbind0: '987654321',
    }))
    expect(inst.setData).not.toHaveBeenCalledWith(expect.objectContaining({
      wvslotownerpropempty: undefined,
      wvslotownerpropskip: undefined,
    }))
  })

  it('skips own owner id and resolves lowercase owner id from owner component data', async () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerId = allocateOwnerId()
    const proxy = { handle: vi.fn() }
    updateOwnerSnapshot(ownerId, { msg: 'owner-data-alias' }, proxy as any)

    const inst: any = {
      __wvOwnerId: 'scoped-slot-self',
      properties: { __wvOwnerId: 'scoped-slot-self' },
      setData: vi.fn(),
      selectOwnerComponent: () => ({
        data: {
          __wvOwnerId: 'scoped-slot-self',
          wvslotownerid: ownerId,
        },
      }),
    }
    opts.lifetimes.attached.call(inst)

    await flushScopedSlotTimers(2)
    expect(inst.__wvOwnerIdCurrent).toBe(ownerId)
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({ 'wvslotowner.msg': 'owner-data-alias' }))
    expect(inst.setData).not.toHaveBeenCalledWith(expect.objectContaining({ 'wvslotowner.msg': 'self-owner' }))
  })

  it('retries owner id from owner component data in ready lifecycle', async () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerId = allocateOwnerId()
    const proxy = { handle: vi.fn() }
    updateOwnerSnapshot(ownerId, { msg: 'owner-ready' }, proxy as any)
    let ownerData: Record<string, unknown> = {}

    const inst: any = {
      properties: {},
      setData: vi.fn(),
      selectOwnerComponent: () => ({
        data: ownerData,
      }),
    }
    opts.lifetimes.attached.call(inst)
    await flushScopedSlotTimers(2)
    expect(inst.__wvOwnerProxy).toBeUndefined()

    ownerData = { __wvOwnerId: ownerId }
    opts.lifetimes.ready.call(inst)
    await flushScopedSlotTimers(2)
    expect(inst.__wvOwnerProxy).toBe(proxy)
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({ 'wvslotowner.msg': 'owner-ready' }))
  })

  it('falls back to remembered slot owner id when generic outlet props are hidden', async () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerId = allocateOwnerId()
    const proxy = { handle: vi.fn() }
    updateOwnerSnapshot(ownerId, { msg: 'remembered-owner' }, proxy as any)
    rememberSlotOwnerId(ownerId)

    const inst: any = {
      properties: {},
      setData: vi.fn(),
    }
    opts.lifetimes.attached.call(inst)
    await flushScopedSlotTimers(2)
    expect(inst.__wvOwnerProxy).toBe(proxy)
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({ 'wvslotowner.msg': 'remembered-owner' }))
  })

  it('does not fall back to the scoped slot component own owner id', async () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownOwnerId = allocateOwnerId()
    rememberSlotOwnerId(ownOwnerId)

    const inst: any = {
      __wvOwnerId: ownOwnerId,
      properties: {},
      setData: vi.fn(),
    }
    opts.lifetimes.attached.call(inst)
    await flushScopedSlotTimers(2)

    expect(inst.__wvOwnerProxy).toBeUndefined()
    expect(inst.setData).not.toHaveBeenCalledWith(expect.objectContaining({ 'wvslotowner.__wvOwnerProxy': undefined }))
  })

  it('syncs owner snapshot into runtime state before updating native data', async () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerId = allocateOwnerId()
    const proxy = { handle: vi.fn() }
    updateOwnerSnapshot(ownerId, { text: 'before' }, proxy as any)

    const inst: any = {
      __wevu: {
        state: {
          __wvOwner: {},
          __wvOwnerProxy: undefined,
        },
      },
      properties: { __wvOwnerId: ownerId },
      setData: vi.fn(),
    }
    opts.lifetimes.attached.call(inst)
    await flushScopedSlotTimers()

    expect(inst.__wevu.state.__wvOwner).toEqual({ text: 'before' })
    expect(inst.__wevu.state.__wvOwnerProxy).toBe(proxy)
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      '__wvOwner.text': 'before',
      'wvslotowner.text': 'before',
    }))

    inst.setData.mockClear()
    updateOwnerSnapshot(ownerId, { text: 'after' }, proxy as any)
    await flushScopedSlotTimers(2)

    expect(inst.__wevu.state.__wvOwner).toEqual({ text: 'after' })
    expect(inst.__wevu.state.__wvOwnerProxy).toBe(proxy)
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      '__wvOwner.text': 'after',
      'wvslotowner.text': 'after',
    }))
  })

  it('does not mirror dashed owner id props into scoped slot owner id state', () => {
    defineComponent({
      setup() {
        return {}
      },
    })

    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const inst: any = {
      setData: vi.fn(),
      triggerEvent: vi.fn(),
      properties: {
        '__wv-slot-owner-id': 'owner-from-attr',
      },
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    expect(inst.__wevu.state.__wevuProps.__wvSlotOwnerId).toBeUndefined()
    expect(inst.__wevu.state.__wevuProps['__wv-slot-owner-id']).toBeUndefined()
  })

  it('recomputes scoped slot bindings after owner proxy is attached', async () => {
    createWevuScopedSlotComponent({
      computed: {
        __wv_bind_0(this: any) {
          try {
            return this.__wvOwnerProxy.func(this.__wvOwnerProxy.text)
          }
          catch {
            return undefined
          }
        },
      },
    })
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()
    expect(opts.data).toMatchObject({
      __wv_bind_0: null,
    })

    const ownerId = allocateOwnerId()
    const proxy = {
      text: '123456789',
      func: (text = '') => text.split('').reverse().join(''),
    }
    updateOwnerSnapshot(ownerId, { text: '123456789' }, proxy as any)

    const inst: any = {
      properties: { __wvOwnerId: ownerId },
      setData: vi.fn(),
      triggerEvent: vi.fn(),
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)
    await nextTick()
    await flushScopedSlotTimers(2)

    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      __wv_bind_0: '987654321',
    }))
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      'wvslotowner.text': '123456789',
      'wvslotowner.__wv_bind_0': '987654321',
    }))
  })

  it('recomputes prefixed scoped slot runtime bindings from owner setup refs', async () => {
    createWevuScopedSlotComponent({
      computed: {
        wvslotbind0(this: any) {
          try {
            return this.__wvOwnerProxy.func(this.__wvOwnerProxy.value)
          }
          catch {
            return undefined
          }
        },
      },
    })
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()
    expect(opts.data).toMatchObject({
      wvslotbind0: null,
    })

    const ownerId = allocateOwnerId()
    const proxy = {
      value: ref('issue-555 conditional slot text'),
      func: (value = '') => value,
    }
    updateOwnerSnapshot(ownerId, { value: 'issue-555 conditional slot text' }, proxy as any)

    const inst: any = {
      properties: { __wvOwnerId: ownerId },
      setData: vi.fn(),
      triggerEvent: vi.fn(),
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)
    await nextTick()
    await flushScopedSlotTimers(2)

    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      wvslotbind0: 'issue-555 conditional slot text',
    }))
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      'wvslotowner.value': 'issue-555 conditional slot text',
      'wvslotowner.wvslotbind0': 'issue-555 conditional slot text',
    }))
  })

  it('recomputes scoped slot runtime bindings from real owner runtime proxy', async () => {
    defineComponent({
      setup() {
        const value = ref('issue-555 conditional slot text')
        function func(text = '') {
          return text.split('').reverse().join('')
        }
        return {
          value,
          text: '123456789',
          func,
        }
      },
    })
    const ownerOpts = registeredComponents.pop()!
    expect(ownerOpts).toBeTruthy()
    const ownerInst: any = {
      properties: {},
      setData: vi.fn(),
      triggerEvent: vi.fn(),
    }
    ownerOpts.lifetimes.created.call(ownerInst)
    ownerOpts.lifetimes.attached.call(ownerInst)

    createWevuScopedSlotComponent({
      computed: {
        textValue(this: any) {
          try {
            return unref((this.__wvOwnerProxy || this.__wvOwner).value)
          }
          catch {
            return undefined
          }
        },
        methodValue(this: any) {
          try {
            return (this.__wvOwnerProxy || this.__wvOwner).func(unref((this.__wvOwnerProxy || this.__wvOwner).text))
          }
          catch {
            return undefined
          }
        },
      },
    })
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerId = ownerInst.__wvOwnerId
    expect(ownerId).toEqual(expect.any(String))
    expect(getOwnerSnapshot(ownerId)).toMatchObject({
      value: 'issue-555 conditional slot text',
      text: '123456789',
    })

    const inst: any = {
      properties: { __wvOwnerId: ownerId },
      setData: vi.fn(),
      triggerEvent: vi.fn(),
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)
    await nextTick()
    await flushScopedSlotTimers(2)

    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      textValue: 'issue-555 conditional slot text',
      methodValue: '987654321',
    }))
  })

  it('enables computed setData for scoped slot runtime bindings when component defaults omit computed', async () => {
    setWevuDefaults({
      component: {
        setData: {
          includeComputed: false,
        },
      },
    })
    createWevuScopedSlotComponent({
      computed: {
        wvslotbind0(this: any) {
          try {
            return this.__wvOwnerProxy.value
          }
          catch {
            return undefined
          }
        },
      },
    })
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerId = allocateOwnerId()
    updateOwnerSnapshot(ownerId, { value: 'issue-555 conditional slot text' }, { value: 'issue-555 conditional slot text' } as any)

    const inst: any = {
      properties: { __wvOwnerId: ownerId },
      setData: vi.fn(),
      triggerEvent: vi.fn(),
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)
    await nextTick()
    await flushScopedSlotTimers(2)

    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      wvslotpropsdata: expect.objectContaining({
        value: 'issue-555 conditional slot text',
      }),
      wvslotbind0: 'issue-555 conditional slot text',
    }))
  })

  it('merges scoped slot computed bindings into owner snapshot', async () => {
    createWevuScopedSlotComponent({
      computed: {
        wvslotbind0(this: any) {
          try {
            return this.__wvOwnerProxy.func(this.__wvOwnerProxy.text)
          }
          catch {
            return undefined
          }
        },
      },
    })
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const ownerId = allocateOwnerId()
    const proxy = {
      text: '123456789',
      func: (text = '') => text.split('').reverse().join(''),
    }
    updateOwnerSnapshot(ownerId, { text: '123456789' }, proxy as any)

    const inst: any = {
      properties: { __wvOwnerId: ownerId },
      setData: vi.fn(),
      triggerEvent: vi.fn(),
    }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)
    await nextTick()
    await flushScopedSlotTimers(2)

    expect(inst.__wevu.state.__wvOwner).toMatchObject({
      text: '123456789',
      wvslotbind0: '987654321',
    })
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      'wvslotpropsdata': expect.objectContaining({
        wvslotbind0: '987654321',
      }),
      'wvslotowner.wvslotbind0': '987654321',
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
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      __wvSlotPropsData: { a: 1, b: 2 },
      wvslotpropsdata: { a: 1, b: 2 },
    }))

    inst.setData.mockClear()
    slotScopeObserver.call(inst, { a: 3 })
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      __wvSlotPropsData: { a: 3, b: 2 },
      wvslotpropsdata: { a: 3, b: 2 },
    }))
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
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      __wvSlotPropsData: { scope: 1, value: 2 },
      wvslotpropsdata: { scope: 1, value: 2 },
    }))

    inst.setData.mockClear()
    slotScopeObserver.call(inst, ['scope', 3])
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({
      __wvSlotPropsData: { scope: 3, value: 2 },
      wvslotpropsdata: { scope: 3, value: 2 },
    }))
  })

  it('keeps slot prop observers on properties', () => {
    createWevuScopedSlotComponent()
    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    expect(opts.properties.__wvSlotOwnerId).toMatchObject({ type: String, value: '' })
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

  it('refreshes owner snapshot after setup bindings are applied', () => {
    function format(value = '') {
      return value.toUpperCase()
    }

    defineComponent({
      setup() {
        return {
          text: 'ready',
          format,
        }
      },
    })

    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const inst: any = { setData: vi.fn(), triggerEvent: vi.fn(), properties: {} }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    const ownerId = inst.__wvOwnerId
    const snapshot = getOwnerSnapshot(ownerId)
    expect(snapshot?.text).toBe('ready')
    expect(inst.__wevu.proxy.format('ok')).toBe('OK')
  })

  it('syncs owner id to native data during initial mount', () => {
    defineComponent({
      setup() {
        return {}
      },
    })

    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const inst: any = { setData: vi.fn(), triggerEvent: vi.fn(), properties: {} }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    const ownerId = inst.__wvOwnerId
    expect(ownerId).toBeTruthy()
    expect(inst.setData).toHaveBeenCalledWith(expect.objectContaining({ __wvOwnerId: ownerId }))
  })

  it('refreshes owner snapshot with unwrapped setup refs', () => {
    defineComponent({
      setup() {
        return {
          text: ref('from-ref'),
        }
      },
    })

    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const inst: any = { setData: vi.fn(), triggerEvent: vi.fn(), properties: {} }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    const ownerId = inst.__wvOwnerId
    expect(getOwnerSnapshot(ownerId)?.text).toBe('from-ref')
  })

  it('refreshes owner snapshot with cross-chunk ref-like setup bindings', () => {
    defineComponent({
      setup() {
        return {
          text: {
            __v_isRef: true,
            value: 'from-ref-like',
          },
        }
      },
    })

    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const inst: any = { setData: vi.fn(), triggerEvent: vi.fn(), properties: {} }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    const ownerId = inst.__wvOwnerId
    expect(getOwnerSnapshot(ownerId)?.text).toBe('from-ref-like')
  })

  it('keeps owner snapshot independent from setData pick', () => {
    function format(value = '') {
      return value.toUpperCase()
    }

    defineComponent({
      setData: {
        pick: ['__wvOwnerId'],
      },
      setup() {
        return {
          text: ref('from-ref'),
          format,
        }
      },
    })

    const opts = registeredComponents.pop()!
    expect(opts).toBeTruthy()

    const inst: any = { setData: vi.fn(), triggerEvent: vi.fn(), properties: {} }
    opts.lifetimes.created.call(inst)
    opts.lifetimes.attached.call(inst)

    const ownerId = inst.__wvOwnerId
    const snapshot = getOwnerSnapshot(ownerId)
    expect(snapshot?.__wvOwnerId).toBe(ownerId)
    expect(snapshot?.text).toBe('from-ref')
    expect(inst.__wevu.snapshot()).toEqual({ __wvOwnerId: ownerId })
    expect(inst.__wevu.proxy.format('ok')).toBe('OK')
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
