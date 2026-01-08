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

    opts.observers.__wvSlotProps.call(inst, { b: 2 })
    expect(inst.setData).toHaveBeenCalledWith({ __wvSlotProps: { a: 1, b: 2 } })

    inst.setData.mockClear()
    opts.observers.__wvSlotScope.call(inst, { a: 3 })
    expect(inst.setData).toHaveBeenCalledWith({ __wvSlotProps: { a: 3, b: 2 } })
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
