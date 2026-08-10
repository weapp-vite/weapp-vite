import { WEVU_JSX_ISLAND_HANDLER_MAP_KEY } from '@weapp-core/constants'
import { describe, expect, it, vi } from 'vitest'
import {
  createTextVNode,
  createVNode,
  Fragment,
  mergeProps,
  normalizeJsxIsland,
  resolveComponent,
  runJsxIslandHandler,
  transformOn,
  vModelCheckbox,
  vModelRadio,
  vModelSelect,
  vModelText,
  vShow,
  withDirectives,
} from '../src/runtime/jsxIsland'
import { normalizeClass, normalizeStyle } from '../src/runtime/template'

const islandAdapters = { normalizeClass, normalizeStyle }

describe('Wevu JSX dynamic island runtime', () => {
  it('normalizes host vnodes into serializable island data', () => {
    const target = {}
    const node = normalizeJsxIsland.call(target, createVNode('view', {
      class: ['panel', { active: true }],
      style: [{ color: 'red' }, 'width:10px'],
    }, [
      createVNode(Fragment, null, [createTextVNode('hello'), createVNode('text', null, 'world')]),
    ]), 'i0', islandAdapters)

    expect(node).toEqual(expect.objectContaining({
      kind: 'element',
      tag: 'view',
      props: expect.objectContaining({ class: 'panel active', style: 'color:red;width:10px' }),
    }))
    expect(JSON.stringify(node)).toContain('hello')
    expect(JSON.stringify(node)).toContain('world')
  })

  it('applies v-show and v-model without serializing updater functions', () => {
    const update = vi.fn()
    const target = {}
    const vnode = withDirectives(createVNode('input', { 'onUpdate:modelValue': update }), [
      [vShow, false],
      [vModelText, 'hello'],
    ])
    const node = normalizeJsxIsland.call(target, vnode, 'i3', islandAdapters)!

    expect(node.props).toMatchObject({ hidden: true, value: 'hello' })
    const handlerId = node.events?.input
    runJsxIslandHandler(target, {
      detail: { value: 'next' },
      currentTarget: { dataset: { wvJsxHandler: handlerId } },
    })
    expect(update).toHaveBeenCalledWith('next')
  })

  it('keeps event functions outside serializable node data and dispatches by id', () => {
    const tap = vi.fn()
    const target = {}
    const node = normalizeJsxIsland.call(target, createVNode('button', { onTap: tap }, 'tap'), 'i1', islandAdapters)!
    const handlerId = node.events?.tap

    expect(handlerId).toBe('i1:0')
    expect(JSON.stringify(node)).not.toContain('function')
    expect((target as any)[WEVU_JSX_ISLAND_HANDLER_MAP_KEY][handlerId!]).toBe(tap)

    const event = { currentTarget: { dataset: { wvJsxHandler: handlerId } } }
    runJsxIslandHandler(target, event)
    expect(tap).toHaveBeenCalledWith(event)
  })

  it('replaces an island handler table on refresh and merges class/style props', () => {
    const oldTap = vi.fn()
    const nextTap = vi.fn()
    const target = {}
    normalizeJsxIsland.call(target, createVNode('view', { onTap: oldTap }), 'i2', islandAdapters)
    normalizeJsxIsland.call(target, createVNode('view', { onTap: nextTap }), 'i2', islandAdapters)

    const handlers = (target as any)[WEVU_JSX_ISLAND_HANDLER_MAP_KEY]
    expect(Object.keys(handlers)).toEqual(['i2:0'])
    expect(handlers['i2:0']).toBe(nextTap)
    expect(mergeProps({ class: 'a', style: 'color:red' }, { class: 'b', style: { width: '2px' } })).toEqual({
      class: ['a', 'b'],
      style: ['color:red', { width: '2px' }],
    })
  })

  it('adapts transformOn, component resolution and named model arguments', () => {
    const update = vi.fn()
    const props = transformOn({ tap: vi.fn() })
    const vnode = withDirectives(createVNode('input', { 'onUpdate:query': update, ...props }), [
      [vModelText, 'hello', 'query'],
    ])
    const target = {}
    const node = normalizeJsxIsland.call(target, vnode, 'i4', islandAdapters)!

    expect(resolveComponent('Panel')).toBe('Panel')
    expect(node.props?.query).toBe('hello')
    expect(node.events?.tap).toMatch(/^i4:\d+$/)
    expect((target as any)[WEVU_JSX_ISLAND_HANDLER_MAP_KEY][node.events?.tap ?? '']).toBe(props.onTap)
  })

  it('normalizes nullish values, nested arrays, slots and functional components', () => {
    const target = {}
    const Panel = (props: Record<string, any>, children: unknown) => createVNode(
      'view',
      { id: props.id },
      [props.title, children],
    )
    const node = normalizeJsxIsland.call(target, [
      null,
      false,
      createVNode(Panel, { id: 'panel', title: 'title' }, { default: () => createTextVNode('slot') }),
      [createTextVNode('tail')],
    ], 'i5', islandAdapters)

    expect(node).toEqual(expect.objectContaining({
      kind: 'fragment',
      children: expect.arrayContaining([
        expect.objectContaining({ kind: 'element', tag: 'view' }),
        expect.objectContaining({ kind: 'text', text: 'tail' }),
      ]),
    }))
    expect(JSON.stringify(node)).toContain('slot')
  })

  it.each([
    ['vModelText', vModelText, 'input', { value: 'next' }],
    ['vModelCheckbox', vModelCheckbox, 'change', { value: true }],
    ['vModelRadio', vModelRadio, 'change', { value: 'radio' }],
    ['vModelSelect', vModelSelect, 'change', { value: 'select' }],
  ] as const)('maps %s to its host event without serializing updater', (_name, directive, eventName, detail) => {
    const update = vi.fn()
    const target = {}
    const node = normalizeJsxIsland.call(target, withDirectives(
      createVNode('input', { 'onUpdate:modelValue': update }),
      [[directive, detail.value]],
    ), 'i6', islandAdapters)!

    expect(node.events?.[eventName]).toMatch(/^i6:\d+$/)
    expect(JSON.stringify(node)).not.toContain('function')
    runJsxIslandHandler(target, {
      detail,
      currentTarget: { dataset: { wvJsxHandler: node.events?.[eventName] } },
    })
    expect(update).toHaveBeenCalledWith(detail.value)
  })

  it('uses the runtime proxy as handler this and ignores invalid event payloads', () => {
    const target: any = { __wevu: { proxy: { value: 3 } } }
    const handler = vi.fn(function (this: any) {
      return this.value
    })
    const node = normalizeJsxIsland.call(target, createVNode('button', { onTap: handler }), 'i7', islandAdapters)!

    expect(runJsxIslandHandler(target, {
      target: { dataset: { wvJsxHandler: node.events?.tap } },
    })).toBe(3)
    expect(runJsxIslandHandler(target, {})).toBeUndefined()
    expect(runJsxIslandHandler(target, {
      currentTarget: { dataset: { wvJsxHandler: 'missing' } },
    })).toBeUndefined()
  })
})
