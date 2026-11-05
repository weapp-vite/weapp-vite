import { describe, expect, it } from 'vitest'
import { parse, scan } from './index'

describe('compatibility dialect validation', () => {
  it.each([null, 'opaque', {}, new Set(['opaque'])])('rejects non-array rawTags: %s', (rawTags) => {
    for (const read of [parse, scan]) {
      expect(() => read('<opaque><view/></opaque>', { rawTags: rawTags as never }))
        .toThrow('Expected rawTags to be an array of nonempty names.')
    }
  })

  it('refreshes cached dialects after same-length raw tag replacement', () => {
    const source = '<opaque><view/></opaque><other><text/></other>'
    const rawTags = ['opaque']
    const first = parse(source, { syntax: 'xml', rawTags })
    expect(first.children).toMatchObject([
      { kind: 'element', name: 'opaque', children: [{ kind: 'script', data: '<view/>' }] },
      { kind: 'element', name: 'other', children: [{ kind: 'element', name: 'text' }] },
    ])

    rawTags[0] = 'other'
    const second = parse(source, { syntax: 'xml', rawTags })
    const third = parse(source, { syntax: 'xml', rawTags })
    expect(second.children).toMatchObject([
      { kind: 'element', name: 'opaque', children: [{ kind: 'element', name: 'view' }] },
      { kind: 'element', name: 'other', children: [{ kind: 'script', data: '<text/>' }] },
    ])
    expect(second.options.rawTags).toEqual(['other'])
    expect(second.options).toBe(third.options)
    expect(third.children).toEqual(second.children)
    expect(second.options).not.toBe(first.options)
    expect(first.options.rawTags).toEqual(['opaque'])
    expect(first.children).toMatchObject([
      { kind: 'element', name: 'opaque', children: [{ kind: 'script', data: '<view/>' }] },
      { kind: 'element', name: 'other', children: [{ kind: 'element', name: 'text' }] },
    ])
  })
})
