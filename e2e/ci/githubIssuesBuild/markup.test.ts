import { describe, expect, it } from 'vitest'
import { findMarkupElements } from './markup'

describe('build markup queries', () => {
  it('keeps component attributes and bindings independent from added DOM selectors', () => {
    const [card] = findMarkupElements('<view><slot-card id="card" vue-slots="{{ {header:true} }}" class="provided" /></view>', 'slot-card')
    expect(card.attribs).toMatchObject({
      'class': 'provided',
      'vue-slots': '{{ {header:true} }}',
    })
    expect(findMarkupElements('<slot-card-other />', 'slot-card')).toEqual([])
  })

  it('preserves inline children and case-sensitive binding attributes', () => {
    const [item] = findMarkupElements('<native-item wx:for-item="entry" __wvSlotOwnerId="{{owner}}"><text>{{entry.label}}</text></native-item>', 'native-item')
    expect(item.attribs).toEqual({ 'wx:for-item': 'entry', '__wvSlotOwnerId': '{{owner}}' })
    expect(item.children).toMatchObject([{ name: 'text', children: [{ data: '{{entry.label}}' }] }])
  })
})
