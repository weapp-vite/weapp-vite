import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from '@/reactivity'
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
      __wevuReadyCalled: true,
      __wevu: { state: {}, proxy: {} },
      createSelectorQuery: createSelectorQueryFactory(resolver),
      __wevuTemplateRefs: [
        { selector: '.single', inFor: false, name: 'single' },
        { selector: '.list', inFor: true, name: 'list' },
      ],
    }

    setCurrentInstance(instance)
    const singleRef = useTemplateRef(' single ')
    const sameRef = useTemplateRef('single')
    const listRef = useTemplateRef('list')

    expect(singleRef).toBe(sameRef)

    updateTemplateRefs(instance)

    const refs = instance.__wevu.state.$refs
    expect(refs.single).toBe(singleRef.value)
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
      __wevuReadyCalled: true,
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
      __wevuExposed: { headerKey, setHeaderKey },
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
    expect(refs.header.setHeaderKey).toBe(setHeaderKey)
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

    expect(instance.__wevuTemplateRefsPending).toBe(true)
    await nextTick()

    expect(instance.__wevuTemplateRefsPending).toBe(false)
    expect(instance.__wevu.state.$refs.batched).toBeTruthy()
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
      __wevuReadyCalled: true,
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
