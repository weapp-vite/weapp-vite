import type { TemplateRefValue } from '@/runtime/types'
import {
  WEVU_EXPOSED_KEY,
  WEVU_READY_CALLED_KEY,
  WEVU_TEMPLATE_REFS_PENDING_KEY,
} from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref } from '@/reactivity'
import { setCurrentInstance } from '@/runtime/hooks'
import { clearTemplateRefs, scheduleTemplateRefUpdate, updateTemplateRefs } from '@/runtime/templateRefs'
import { useTemplateRef } from '@/runtime/vueCompat'
import { nextTick } from '@/scheduler'

type QueryResolver = (selector: string, multiple: boolean) => any

function createSelectorQueryFactory(resolver: QueryResolver) {
  return () => {
    const queue: Array<{ selector: string, multiple: boolean }> = []
    const nodesRef = {
      boundingClientRect: () => {},
      scrollOffset: () => {},
      fields: (_fields?: any) => {},
      node: () => {},
    }
    return {
      select(selector: string) {
        queue.push({ selector, multiple: false })
        return nodesRef
      },
      selectAll(selector: string) {
        queue.push({ selector, multiple: true })
        return nodesRef
      },
      exec(cb: (res: any[]) => void) {
        cb(queue.map(item => resolver(item.selector, item.multiple)))
      },
    }
  }
}

afterEach(() => {
  setCurrentInstance(undefined)
  delete (globalThis as any).wx
})

describe('runtime: template refs', () => {
  it('useTemplateRef requires setup and valid name', () => {
    setCurrentInstance(undefined)
    expect(() => useTemplateRef('cell')).toThrow('useTemplateRef()')

    setCurrentInstance({} as any)
    expect(() => useTemplateRef('   ')).toThrow('useTemplateRef() 需要传入有效的模板 ref 名称')
  })

  it('useTemplateRef caches refs and syncs with template updates', async () => {
    const resolver: QueryResolver = (selector) => {
      if (selector === '.single') {
        return { id: 'single' }
      }
      if (selector === '.list') {
        return [{ id: 'list-1' }, { id: 'list-2' }]
      }
      return null
    }

    const instance: any = {
      [WEVU_READY_CALLED_KEY]: true,
      __wevu: { state: {}, proxy: {} },
      createSelectorQuery: createSelectorQueryFactory(resolver),
      __wevuTemplateRefs: [
        { selector: '.single', inFor: false, name: 'single' },
        { selector: '.list', inFor: true, name: 'list' },
      ],
    }

    setCurrentInstance(instance)
    const singleRef = useTemplateRef<TemplateRefValue>(' single ')
    const sameRef = useTemplateRef('single')
    const listRef = useTemplateRef<TemplateRefValue[]>('list')

    expect(singleRef).toBe(sameRef)

    updateTemplateRefs(instance)

    const refs = instance.__wevu.state.$refs
    expect(refs.single).toBe(singleRef.value)
    expect(singleRef.value?.selector).toBe('.single')
    expect(Array.isArray(listRef.value)).toBe(true)
    expect((listRef.value as any[]).length).toBe(2)
    expect((listRef.value as any[])[0].selector).toBe('.list')

    const wrappers = listRef.value as any[]
    let cbValue: any
    const nodeValue = await wrappers[1].node((value: any) => {
      cbValue = value
    })
    expect(nodeValue).toEqual({ id: 'list-2' })
    expect(cbValue).toEqual({ id: 'list-2' })
  })

  it('updateTemplateRefs handles function/ref/name targets and clearTemplateRefs resets state', () => {
    const fnEmpty = vi.fn()
    const fnItems = vi.fn()
    const refTarget = ref<any>(null)

    const resolver: QueryResolver = (selector) => {
      if (selector === '.fn-empty') {
        return []
      }
      if (selector === '.fn-items') {
        return [{ id: 'item-1' }, { id: 'item-2' }]
      }
      if (selector === '.ref') {
        return { id: 'ref' }
      }
      if (selector === '.named') {
        return { id: 'named-1' }
      }
      if (selector === '.named-again') {
        return { id: 'named-2' }
      }
      if (selector === '.for') {
        return [{ id: 'for-1' }, { id: 'for-2' }]
      }
      if (selector === '.throws') {
        return { id: 'fallback' }
      }
      if (selector === '.skip') {
        return { id: 'skip' }
      }
      return null
    }

    const instance: any = {
      [WEVU_READY_CALLED_KEY]: true,
      __wevu: { state: { $refs: { stale: 'value' } }, proxy: {} },
      createSelectorQuery: createSelectorQueryFactory(resolver),
      __wevuTemplateRefs: [
        { selector: '.fn-empty', inFor: true, get: () => fnEmpty },
        { selector: '.fn-items', inFor: true, get: () => fnItems },
        { selector: '.ref', inFor: false, get: () => refTarget },
        { selector: '.named', inFor: false, get: () => 'named' },
        { selector: '.named-again', inFor: false, name: 'named' },
        { selector: '.for', inFor: true, name: 'items' },
        { selector: '.throws', inFor: false, name: 'fallback', get: () => { throw new Error('boom') } },
        { selector: '.skip', inFor: false, get: () => ({}) },
      ],
    }

    updateTemplateRefs(instance)

    expect(fnEmpty).toHaveBeenCalledWith(null)
    expect(fnItems).toHaveBeenCalledTimes(2)
    expect(fnItems.mock.calls[0][0].selector).toBe('.fn-items')
    expect(refTarget.value?.selector).toBe('.ref')

    const refs = instance.__wevu.state.$refs
    expect(refs.stale).toBeUndefined()
    expect(Array.isArray(refs.named)).toBe(true)
    expect(refs.named.length).toBe(2)
    expect(Array.isArray(refs.items)).toBe(true)
    expect(refs.items.length).toBe(2)
    expect(refs.fallback?.selector).toBe('.throws')
    expect(refs.skip).toBeUndefined()

    clearTemplateRefs(instance)

    expect(fnEmpty).toHaveBeenCalledTimes(2)
    expect(fnItems).toHaveBeenCalledTimes(3)
    expect(fnItems.mock.calls[2][0]).toBeNull()
    expect(refTarget.value).toBeNull()
    expect(refs.named).toBeNull()
    expect(Array.isArray(refs.items)).toBe(true)
    expect(refs.items.length).toBe(0)
    expect(refs.fallback).toBeNull()
  })

  it('resolves component template refs via selectComponent', () => {
    const headerKey = ref('hello')
    const setHeaderKey = vi.fn()
    const componentInstance = {
      [WEVU_EXPOSED_KEY]: { headerKey, setHeaderKey },
      [WEVU_READY_CALLED_KEY]: true,
      __wevu: { proxy: {} },
    }

    const instance: any = {
      __wevuReadyCalled: true,
      __wevu: { state: {}, proxy: {} },
      selectComponent: vi.fn(() => componentInstance),
      __wevuTemplateRefs: [
        { selector: '.header', inFor: false, name: 'header', kind: 'component' },
      ],
    }

    updateTemplateRefs(instance)

    const refs = instance.__wevu.state.$refs
    expect(refs.header.headerKey).toBe('hello')
    expect(typeof refs.header.setHeaderKey).toBe('function')
    expect(refs.header.selector).toBe('.header')
    refs.header.setHeaderKey('world')
    expect(setHeaderKey).toHaveBeenCalledWith('world')
  })

  it('does not query a lazy component ref while clearing a reactive setup ref', () => {
    const componentRef = ref<any>()
    const componentInstance = {
      [WEVU_READY_CALLED_KEY]: true,
      __wevu: { proxy: {} },
      open: vi.fn(),
    }
    const selectComponent = vi.fn(() => componentInstance)
    const instance: any = {
      [WEVU_READY_CALLED_KEY]: true,
      __wevu: {
        state: {},
        proxy: {},
        setupState: reactive({ componentRef }),
      },
      selectComponent,
      __wevuTemplateRefs: [
        { selector: '.component', inFor: false, name: 'componentRef', kind: 'component' },
      ],
    }

    updateTemplateRefs(instance)
    expect(selectComponent).toHaveBeenCalledTimes(1)
    expect(componentRef.value).toBeTruthy()

    clearTemplateRefs(instance)

    expect(componentRef.value).toBeNull()
    expect(selectComponent).toHaveBeenCalledTimes(1)
  })

  it('does not expose a wevu component template ref before ready', () => {
    const child: any = {
      [WEVU_EXPOSED_KEY]: { open: vi.fn() },
      __wevu: { proxy: {} },
    }
    const childRef = ref<any>(undefined)
    const instance: any = {
      [WEVU_READY_CALLED_KEY]: true,
      __wevu: {
        state: {},
        proxy: {},
        setupState: { childRef },
      },
      selectComponent: vi.fn(() => child),
      __wevuTemplateRefs: [
        { selector: '.child', inFor: false, name: 'childRef', kind: 'component' },
      ],
    }

    updateTemplateRefs(instance)
    expect(childRef.value).toBeNull()

    child[WEVU_READY_CALLED_KEY] = true
    updateTemplateRefs(instance)
    expect(childRef.value.open).toEqual(expect.any(Function))
  })

  it('queries a scoped slot component while assigning the ref to its owner', () => {
    const ownerRef = ref<any>(null)
    const owner: any = {
      [WEVU_READY_CALLED_KEY]: true,
      __wevu: {
        state: {},
        proxy: {},
        setupState: { leaf: ownerRef },
      },
    }
    const leaf = { marker: 'scoped-leaf' }
    const scopedSlot: any = {
      [WEVU_READY_CALLED_KEY]: true,
      __wevu: { state: {}, proxy: {} },
      selectComponent: vi.fn(() => leaf),
      __wevuTemplateRefs: [
        { selector: '.__wevu-ref-0', inFor: false, name: 'leaf', kind: 'component' },
      ],
    }

    updateTemplateRefs(scopedSlot, undefined, owner)

    expect(scopedSlot.selectComponent).toHaveBeenCalledWith('.__wevu-ref-0')
    expect(ownerRef.value.marker).toBe('scoped-leaf')
    expect(owner.__wevu.state.$refs.leaf).toBeUndefined()
    expect(scopedSlot.__wevu.state.$refs).toBeUndefined()

    clearTemplateRefs(scopedSlot, owner)
    expect(ownerRef.value).toBeNull()
  })

  it('writes static component template refs into matching setup refs', () => {
    const monthPanelRef = ref<any>()
    const componentInstance = {
      [WEVU_READY_CALLED_KEY]: true,
      __wevu: { proxy: {} },
      getMonths: vi.fn(() => ['2026-07']),
    }

    const instance: any = {
      __wevuReadyCalled: true,
      __wevu: {
        state: {},
        proxy: {},
        setupState: { monthPanelRef },
      },
      selectComponent: vi.fn(() => componentInstance),
      __wevuTemplateRefs: [
        { selector: '.month-panel', inFor: false, name: 'monthPanelRef', kind: 'component' },
      ],
    }

    updateTemplateRefs(instance)

    expect(monthPanelRef.value).toBeTruthy()
    expect(monthPanelRef.value.getMonths()).toEqual(['2026-07'])
    expect(instance.__wevu.state.$refs.monthPanelRef).toBeUndefined()

    clearTemplateRefs(instance)
    expect(monthPanelRef.value).toBeNull()
  })

  it('resolves public methods lazily when a conditional component mounts later', () => {
    const conditionalRef = ref<any>()
    const open = vi.fn()
    let mounted = false
    const instance: any = {
      __wevuReadyCalled: true,
      __wevu: {
        state: {},
        proxy: {},
        setupState: { conditionalRef },
      },
      selectComponent: vi.fn(() => mounted ? { open } : null),
      __wevuTemplateRefs: [
        { selector: '.conditional', inFor: false, name: 'conditionalRef', kind: 'component' },
      ],
    }

    updateTemplateRefs(instance)
    expect(conditionalRef.value).toBeNull()

    mounted = true
    updateTemplateRefs(instance)
    conditionalRef.value.open()
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('binds component template ref methods to the original instance', () => {
    const componentInstance = {
      count: 0,
      inc() {
        this.count += 1
        return this.count
      },
    }

    const instance: any = {
      __wevuReadyCalled: true,
      __wevu: { state: {}, proxy: {} },
      selectComponent: vi.fn(() => componentInstance),
      __wevuTemplateRefs: [
        { selector: '.counter', inFor: false, name: 'counter', kind: 'component' },
      ],
    }

    updateTemplateRefs(instance)

    const refs = instance.__wevu.state.$refs
    expect(refs.counter.inc()).toBe(1)
    expect(componentInstance.count).toBe(1)
  })

  it('writes custom fields on component template refs back to the original instance', () => {
    const componentInstance: any = {
      count: 0,
    }

    const instance: any = {
      __wevuReadyCalled: true,
      __wevu: { state: {}, proxy: {} },
      selectComponent: vi.fn(() => componentInstance),
      __wevuTemplateRefs: [
        { selector: '.dialog', inFor: false, name: 'dialog', kind: 'component' },
      ],
    }

    updateTemplateRefs(instance)

    const refs = instance.__wevu.state.$refs
    const onConfirm = vi.fn()
    refs.dialog._onConfirm = onConfirm

    expect(componentInstance._onConfirm).toBe(onConfirm)
    expect(typeof refs.dialog._onConfirm).toBe('function')
    refs.dialog._onConfirm('ok')
    expect(onConfirm).toHaveBeenCalledWith('ok')
  })

  it('keeps native component property descriptors proxy-safe', () => {
    const componentInstance: any = {}
    Object.defineProperty(componentInstance, '__data__', {
      value: { text: 'hello' },
      configurable: false,
      enumerable: true,
      writable: false,
    })

    const instance: any = {
      __wevuReadyCalled: true,
      __wevu: { state: {}, proxy: {} },
      selectComponent: vi.fn(() => componentInstance),
      __wevuTemplateRefs: [
        { selector: '.native', inFor: false, name: 'native', kind: 'component' },
      ],
    }

    updateTemplateRefs(instance)

    const refs = instance.__wevu.state.$refs
    expect(() => Object.keys(refs.native)).not.toThrow()
    const descriptor = Object.getOwnPropertyDescriptor(refs.native, '__data__')
    expect(descriptor?.configurable).toBe(true)
    expect(descriptor?.enumerable).toBe(true)
    expect(descriptor?.value).toEqual({ text: 'hello' })
  })

  it('scheduleTemplateRefUpdate batches updates', async () => {
    const resolver: QueryResolver = (selector) => {
      if (selector === '.batched') {
        return { id: 'batched' }
      }
      return null
    }

    const instance: any = {
      __wevuReadyCalled: true,
      __wevu: { state: {}, proxy: {} },
      createSelectorQuery: createSelectorQueryFactory(resolver),
      __wevuTemplateRefs: [
        { selector: '.batched', inFor: false, name: 'batched' },
      ],
    }

    scheduleTemplateRefUpdate(instance)
    scheduleTemplateRefUpdate(instance)

    expect(instance[WEVU_TEMPLATE_REFS_PENDING_KEY]).toBe(true)
    await nextTick()

    expect(instance[WEVU_TEMPLATE_REFS_PENDING_KEY]).toBe(false)
    expect(instance.__wevu.state.$refs.batched).toBeTruthy()
    expect(instance.__wevu.state.$refs.batched.selector).toBe('.batched')
  })

  it('falls back to wx selector query when instance lacks one', () => {
    const resolver: QueryResolver = (selector) => {
      if (selector === '.wx') {
        return { id: 'wx' }
      }
      return null
    }
    const createQuery = createSelectorQueryFactory(resolver)
    const wxQuery = { in: vi.fn(() => createQuery()) }
    const wx = { createSelectorQuery: vi.fn(() => wxQuery) }
    ;(globalThis as any).wx = wx

    const instance: any = {
      [WEVU_READY_CALLED_KEY]: true,
      __wevu: { state: {}, proxy: {} },
      __wevuTemplateRefs: [
        { selector: '.wx', inFor: false, name: 'wx' },
      ],
    }

    updateTemplateRefs(instance)

    expect(wx.createSelectorQuery).toHaveBeenCalled()
    expect(wxQuery.in).toHaveBeenCalledWith(instance)
    expect(instance.__wevu.state.$refs.wx).toBeTruthy()
  })
})
