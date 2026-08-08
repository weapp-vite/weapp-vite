import type { ChildNode } from 'domhandler'
import { describe, expect, it } from 'vitest'
import { createTemplate, renderTemplate } from '../src/runtime/legacyTemplate'

describe('legacy template renderer contracts', () => {
  it('filters directives, comments and whitespace while caching parsed templates', () => {
    const source = '<?xml version="1.0"?><!-- ignored -->   <view>{{label}}</view>'
    const first = createTemplate(source)
    const second = createTemplate(source)
    expect(first({ label: '<ready>' })).toBe('<weapp-view>&lt;ready&gt;</weapp-view>')
    expect(second({ label: 'cached' })).toBe('<weapp-view>cached</weapp-view>')
  })

  it('renders interrupted, empty and exhausted conditional sequences', () => {
    const interrupted = createTemplate(`
      <view wx:if="{{first}}">first</view>
      <view wx:if="{{second}}">second</view>
      <view wx:elif="{{third}}">third</view>
    `)
    expect(interrupted({ first: false, second: false, third: true })).toContain('third')
    expect(interrupted({ first: false, second: false, third: false })).toBe('')

    const emptyCondition = createTemplate('<view wx:if="">empty</view><view wx:else>fallback</view>')
    expect(emptyCondition({})).toContain('fallback')

    const orphan = createTemplate('<view wx:elif="{{ready}}">orphan</view>')
    expect(orphan({ ready: true })).toContain('orphan')
  })

  it('renders empty loops, fragments and HTML self-closing elements', () => {
    const template = createTemplate(`
      <block wx:for="{{items}}" wx:for-item="entry"><view>{{entry}}</view></block>
      <img src="/cover.png" />
    `)
    expect(template({ items: [] })).toBe('<img src="/cover.png" />')
    expect(template({ items: ['a', 'b'] })).toContain('<weapp-view>a</weapp-view><weapp-view>b</weapp-view>')
  })

  it('renders generic tree containers and ignores unsupported leaf nodes', () => {
    expect(renderTemplate(undefined as any)).toBe('')
    const tree = [{
      type: 'root',
      children: [{ type: 'text', data: 'content' }],
    }, {
      type: 'comment',
      data: 'ignored',
    }] as unknown as ChildNode[]
    expect(renderTemplate(tree)).toBe('content')

    expect(renderTemplate([{
      type: 'root',
      children: undefined,
    } as unknown as ChildNode])).toBe('')
  })
})
