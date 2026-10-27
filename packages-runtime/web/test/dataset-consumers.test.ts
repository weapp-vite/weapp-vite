// @vitest-environment happy-dom

import type { ComponentPublicInstance } from '../src/runtime/component'
import type { TemplateRenderer } from '../src/runtime/template'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineComponent } from '../src/runtime/component'
import { readRuntimeDataset } from '../src/runtime/dataset'
import { ensureNativeComponentsDefined } from '../src/runtime/nativeComponents'
import { installMiniProgramGlobals } from '../src/runtime/polyfill'
import { createIntersectionObserverBridge } from '../src/runtime/polyfill/intersectionObserver'
import { createTemplate } from '../src/runtime/template'
import { compileDatasetTemplate } from './helpers/datasetTemplate'

type TestElement = ComponentPublicInstance & { updateComplete: Promise<boolean> }
type Mode = 'compiled' | 'legacy'
let sequence = 0

function template(source: string, mode: Mode): TemplateRenderer {
  return mode === 'compiled' ? compileDatasetTemplate(source) : createTemplate(source)
}

async function mount(source: string, mode: Mode, data: Record<string, unknown>, capture = vi.fn()) {
  const tag = `dataset-owner-${++sequence}`
  defineComponent(tag, { template: template(source, mode), component: { data, methods: { capture } } })
  const host = document.createElement(tag) as TestElement
  document.body.append(host)
  await host.updateComplete
  return host
}

beforeAll(() => {
  ensureNativeComponentsDefined()
  installMiniProgramGlobals()
})
afterEach(() => {
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe.each<Mode>(['compiled', 'legacy'])('%s dataset consumers', (mode) => {
  it('uses canonical HTML attribute casing without colliding with hyphenated dataset names', async () => {
    const capture = vi.fn()
    const item = { id: 'typed' }
    const host = await mount('<view id="probe" data-itemName="{{item}}" data-Foo="{{count}}" data-item-name="{{label}}" bindtap="capture" />', mode, { item, count: 0, label: 'hyphenated' }, capture)
    const element = host.shadowRoot!.querySelector('#probe')!
    expect(element.getAttributeNames()).toEqual(expect.arrayContaining(['data-itemname', 'data-foo', 'data-item-name']))
    element.dispatchEvent(new MouseEvent('click'))
    expect(capture.mock.calls[0]![0].currentTarget.dataset).toMatchObject({ itemname: item, foo: 0, itemName: 'hyphenated' })
    expect(capture.mock.calls[0]![0].currentTarget.dataset).not.toHaveProperty('Foo')
    const selected = vi.fn()
    await host.createSelectorQuery().select('#probe').fields({ dataset: true }, selected).exec()
    expect(selected.mock.calls[0]![0].dataset).toMatchObject({ itemname: item, foo: 0, itemName: 'hyphenated' })
    expect(selected.mock.calls[0]![0].dataset).not.toHaveProperty('Foo')
  })

  it('preserves raw complete expressions and stringifies every mixed interpolation segment', async () => {
    const host = await mount('<view id="probe" data-value="{{value}}" data-spaced=" {{value}} " data-mixed="value={{value}}" data-adjacent="{{first}}{{second}}" data-literal="0" />', mode, {
      value: 0,
      first: 1,
      second: 2,
    })
    for (const value of [0, false, { id: 'same' }, [1, 2], 'plain', null, undefined]) {
      await host.setData({ value })
      await host.updateComplete
      const element = host.shadowRoot!.querySelector('#probe')!
      expect(element.getAttribute('data-value')).toBe(String(value ?? ''))
      expect(readRuntimeDataset(element)).toEqual({
        value,
        spaced: value,
        mixed: `value=${value ?? ''}`,
        adjacent: '12',
        literal: '0',
      })
    }
  })

  it('uses the source dataset for target and the listening element dataset for currentTarget', async () => {
    const capture = vi.fn()
    const host = await mount('<view id="parent" data-item="{{parent}}" bindtap="capture"><view id="child" data-item="{{child}}" data-count="{{count}}" /></view>', mode, {
      parent: { id: 'parent' },
      child: { id: 'child' },
      count: 0,
    }, capture)
    host.shadowRoot!.querySelector('#child')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(capture).toHaveBeenCalledOnce()
    expect(capture.mock.calls[0]![0]).toMatchObject({
      target: { dataset: { item: { id: 'child' }, count: 0 } },
      currentTarget: { dataset: { item: { id: 'parent' } } },
    })
  })

  it('keeps values typed in scoped selector and native or fallback intersection callbacks', async () => {
    const host = await mount('<view id="probe" data-index="{{index}}" data-enabled="{{enabled}}" data-literal="0" data-item="{{item}}" />', mode, {
      index: 0,
      enabled: false,
      item: { status: 'ready', list: [1, 2] },
    })
    const expected = { index: 0, enabled: false, literal: '0', item: { status: 'ready', list: [1, 2] } }
    const selected = vi.fn()
    await host.createSelectorQuery().select('#probe').fields({ dataset: true }, selected).exec()
    expect(selected).toHaveBeenCalledWith(expect.objectContaining({ dataset: expected }))

    for (const native of [true, false]) {
      vi.stubGlobal('IntersectionObserver', native
        ? class {
          constructor(private readonly callback: IntersectionObserverCallback) {}
          observe(target: Element) {
            this.callback([{
              target,
              intersectionRatio: 1,
              time: 0,
              boundingClientRect: target.getBoundingClientRect(),
              intersectionRect: target.getBoundingClientRect(),
              rootBounds: null,
            } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
          }

          disconnect() {}
        }
        : undefined)
      const observed = vi.fn()
      const observer = createIntersectionObserverBridge(host)
      observer.observe('#probe', observed)
      await Promise.resolve()
      expect(observed).toHaveBeenCalledWith(expect.objectContaining({ dataset: expected }))
      observer.disconnect()
    }
  })

  it('preserves component host datasets without using the component inner node dataset', async () => {
    const childTag = `dataset-child-${++sequence}`
    defineComponent(childTag, { template: template('<view data-kind="inner" />', mode) })
    const capture = vi.fn()
    const host = await mount(`<${childTag} id="child" data-item="{{item}}" data-index="{{index}}" bind:select="capture" />`, mode, {
      item: { status: 'selected' },
      index: 0,
    }, capture)
    const child = host.shadowRoot!.querySelector('#child') as TestElement
    await child.updateComplete
    child.triggerEvent('select', { selected: true })
    expect(capture).toHaveBeenCalledOnce()
    expect(capture.mock.calls[0]![0]).toMatchObject({
      target: { dataset: { item: { status: 'selected' }, index: 0 } },
      currentTarget: { dataset: { item: { status: 'selected' }, index: 0 } },
      detail: { selected: true },
    })
  })

  it('updates retained nodes when objects have the same string form and reconnects current values', async () => {
    const host = await mount('<view id="probe" data-item="{{item}}" data-list="{{list}}" data-number="{{number}}" data-empty="{{empty}}" />', mode, {
      item: { id: 'first' },
      list: [1, 2],
      number: 0,
      empty: null,
    })
    const element = host.shadowRoot!.querySelector('#probe')!
    const first = readRuntimeDataset(element).item
    await host.setData({ item: { id: 'next' } })
    await host.updateComplete
    expect(host.shadowRoot!.querySelector('#probe')).toBe(element)
    expect(readRuntimeDataset(element).item).toEqual({ id: 'next' })
    expect(readRuntimeDataset(element).item).not.toBe(first)
    host.remove()
    expect(readRuntimeDataset(element).item).toBe('[object Object]')
    document.body.append(host)
    await host.updateComplete
    expect(readRuntimeDataset(element)).toMatchObject({ item: { id: 'next' }, list: [1, 2], number: 0, empty: null })
    await host.setData({ item: 'plain', list: false })
    await host.updateComplete
    expect(readRuntimeDataset(host.shadowRoot!.querySelector('#probe'))).toMatchObject({ item: 'plain', list: false })
  })

  it('keeps loop and conditional bindings within their own render and component owner', async () => {
    const source = '<view wx:if="{{visible}}"><view wx:for="{{rows}}" wx:key="id" id="row-{{index}}" data-row="{{item}}" data-index="{{index}}" data-label="row-{{index}}" /></view>'
    const first = await mount(source, mode, { visible: true, rows: [{ id: 'a' }, { id: 'b' }] })
    const second = await mount(source, mode, { visible: true, rows: [{ id: 'other' }] })
    expect(readRuntimeDataset(first.shadowRoot!.querySelector('#row-1'))).toMatchObject({ row: { id: 'b' }, index: 1, label: 'row-1' })
    expect(readRuntimeDataset(second.shadowRoot!.querySelector('#row-0')).row).toEqual({ id: 'other' })
    const removed = first.shadowRoot!.querySelector('#row-1')!
    await first.setData({ visible: false })
    await first.updateComplete
    expect(first.shadowRoot!.querySelector('#row-1')).toBeNull()
    expect(readRuntimeDataset(removed).row).toBe('[object Object]')
    await first.setData({ visible: true, rows: [{ id: 'new' }] })
    await first.updateComplete
    expect(readRuntimeDataset(first.shadowRoot!.querySelector('#row-0')).row).toEqual({ id: 'new' })
    expect(readRuntimeDataset(second.shadowRoot!.querySelector('#row-0')).row).toEqual({ id: 'other' })
  })
})
