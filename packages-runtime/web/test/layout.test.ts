import { describe, expect, it } from 'vitest'
import { wrapPageTemplate } from '../src/plugin/layout'

describe('wrapPageTemplate', () => {
  it('returns the original template when no layouts are registered', () => {
    expect(wrapPageTemplate('<view>page</view>', [])).toBe('<view>page</view>')
  })

  it('renders layout branches and forwards referenced props', () => {
    const output = wrapPageTemplate('<view>page</view>', [
      {
        script: '/layouts/default.ts',
        id: 'layouts/default',
        name: 'default',
        tag: 'layout-default',
        template: '<view>{{title}} {{item}} {{index}}</view>',
      },
      {
        script: '/layouts/compact.ts',
        id: 'layouts/compact',
        name: 'compact',
        tag: 'layout-compact',
        template: '<view>{{subtitle}}</view>',
      },
    ])

    expect(output).toContain('wx:if="{{!__wv_page_layout_name || __wv_page_layout_name === \'default\'}}"')
    expect(output).toContain('wx:elif="{{__wv_page_layout_name === \'compact\'}}"')
    expect(output).toContain('title="{{(__wv_page_layout_props&&__wv_page_layout_props.title)}}"')
    expect(output).toContain('subtitle="{{(__wv_page_layout_props&&__wv_page_layout_props.subtitle)}}"')
    expect(output).toContain('<block wx:else><view>page</view></block>')
    expect(output).not.toContain('__wv_page_layout_props&&__wv_page_layout_props.item')
  })
})
