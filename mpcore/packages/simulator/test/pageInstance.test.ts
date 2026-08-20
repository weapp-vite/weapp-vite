import { describe, expect, it, vi } from 'vitest'
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
})
