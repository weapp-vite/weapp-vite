import { describe, expect, it, vi } from 'vitest'
import { normalizeComponentPageDefinition } from '../src/host'
import { attachComponentPage } from '../src/host/componentPageAttachment'
import { createPageInstance } from '../src/runtime'

describe('createPageInstance', () => {
  it('applies setData patches with array-style paths', () => {
    const page = createPageInstance('/pages/demo/index', {
      data: {
        list: [
          { title: 'a' },
        ],
      },
    })

    page.setData({
      'list[0].title': 'updated',
      'list[1].title': 'created',
      'matrix[0][1]': 'x',
    })

    expect(page.data).toEqual({
      list: [
        { title: 'updated' },
        { title: 'created' },
      ],
      matrix: [
        [undefined, 'x'],
      ],
    })
  })

  it('stores query options and invokes setData callback after patching', () => {
    const callback = vi.fn()
    const page = createPageInstance(
      '/pages/demo/index',
      {
        data: {
          nested: {},
        },
      },
      { from: 'entry' },
    )

    page.setData({
      'nested.value': 1,
    }, () => {
      callback(page.data.nested.value, page.options.from, page.__route__)
    })

    expect(callback).toHaveBeenCalledWith(1, 'entry', 'pages/demo/index')
  })

  it('keeps function values when setData uses nested paths', () => {
    const queryFn = vi.fn(() => ['foo', 'bar'])
    const page = createPageInstance('/pages/demo/index', {
      data: {
        __wvOwner: {
          label: 'Result',
        },
      },
    })

    page.setData({
      '__wvOwner.queryFn': queryFn,
    })

    expect(page.data.__wvOwner.queryFn).toBe(queryFn)
    expect(page.data.__wvOwner.queryFn()).toEqual(['foo', 'bar'])
  })

  it('initializes Component page properties before created and attached', () => {
    const snapshots: unknown[] = []
    const definition = normalizeComponentPageDefinition({
      data: { source: 'data-value', local: 'local-value' },
      properties: {
        source: String,
        modelValue: { type: null, value: '' },
        explicit: { type: String, value: 'explicit-value' },
      },
      lifetimes: {
        created() {
          snapshots.push([this.properties.source, this.properties.modelValue, this.data.explicit])
        },
        attached() {
          snapshots.push([this.data.source, this.data.modelValue, this.properties.explicit])
        },
      },
    })
    const page = createPageInstance('/pages/demo/index', definition, { from: 'entry' })

    expect(page.data).toEqual({ source: '', modelValue: '', explicit: 'explicit-value', local: 'local-value' })
    expect(page.properties).toEqual(page.data)
    expect(page.options).toEqual({ from: 'entry' })
    attachComponentPage(page, () => {})
    expect(snapshots).toEqual([['', '', 'explicit-value'], ['', '', 'explicit-value']])

    page.setData({ source: 'updated-source', modelValue: 'updated-model' })
    expect(page.properties).toMatchObject({ source: 'updated-source', modelValue: 'updated-model' })
  })

  it('clones Component page property defaults for every page instance', () => {
    const definition = normalizeComponentPageDefinition({
      properties: {
        items: { type: Array, value: ['initial'] },
        record: { type: Object, value: { count: 1 } },
      },
    })
    const first = createPageInstance('/pages/demo/index', definition)
    first.setData({ 'items[0]': 'updated', 'record.count': 2 })
    const second = createPageInstance('/pages/demo/index', definition)

    expect(first.data).toEqual({ items: ['updated'], record: { count: 2 } })
    expect(second.data).toEqual({ items: ['initial'], record: { count: 1 } })
    expect(second.properties).toEqual(second.data)
  })

  it('does not interpret ordinary Page properties as Component declarations', () => {
    const page = createPageInstance('/pages/demo/index', {
      data: { local: 'local-value' },
      properties: { source: { type: String, value: 'component-only' } },
    })

    expect(page.data).toEqual({ local: 'local-value' })
    expect(page.properties).toEqual({ local: 'local-value' })
  })
})
