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
  it('supports style operators, quoted whitespace and structural selectors', () => {
    const document = parseDocument('<page><view class="group"><text id="first" style="color:#1f2937; padding: 4rpx">first</text><text id="second" title="two words">second</text><text id="third">third</text></view></page>')
    expect(querySelectorAll(document, '[style*="#1f2937"][style$="4rpx"]')[0]?.attribs?.id).toBe('first')
    expect(querySelectorAll(document, '.group > text:nth-child(2)[title="two words"]')[0]?.attribs?.id).toBe('second')
    expect(querySelectorAll(document, '#first + text, #first ~ #third').map(node => node.attribs?.id)).toEqual(['second', 'third'])
    expect(() => querySelectorAll(document, '[style*=')).toThrow()
  })

  it('preserves component aliases and page roots without duplicated descendants', () => {
    const document = parseDocument('<page><view class="outer"><view class="outer"><view data-sim-component="custom-card"><text class="label">card</text></view></view></view></page>')
    const page = document.children[0]!
    expect(querySelectorAll(page, 'page')).toEqual([page])
    expect(querySelectorAll(page, 'page .label')).toHaveLength(1)
    expect(querySelectorAll(page, '.outer .label')).toHaveLength(1)
    expect(querySelectorAll(page, 'component:has(.label), custom-card')).toHaveLength(1)
    const component = querySelectorAll(page, 'custom-card')[0]!
    expect(querySelectorAll(component, 'custom-card')).toEqual([])
    expect(querySelectorAll(component, '.label')).toHaveLength(1)
    expect(querySelectorAll(page, 'view:not(custom-card)')).toHaveLength(2)
  })
})
