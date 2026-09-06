import { parseDocument } from 'htmlparser2'
import { describe, expect, it } from 'vitest'
import { querySelectorAll } from './selectors'

describe('attribute selectors', () => {
  it('queries a route attribute and its descendant without matching another route', () => {
    const document = parseDocument('<page><navigator url="/pages/home/index"><text class="path">home</text></navigator><navigator url="/pages/detail/index?id=42&amp;from=home"><text class="path">detail</text></navigator></page>')
    const nodes = querySelectorAll(document, 'navigator[url="/pages/detail/index?id=42&from=home"] .path')
    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.children?.[0]?.data).toBe('detail')
    expect(querySelectorAll(document, 'navigator[url="/missing"] .path')).toEqual([])
  })
})
