import { WEVU_PAGE_LAYOUT_NAME_KEY } from '@weapp-core/constants'
import { afterEach, describe, expect, it } from 'vitest'
import { parseWxml } from '../src/compiler/wxml/parser'
import { wrapPageTemplate } from '../src/plugin/layout'
import { setRuntimeExecutionMode } from '../src/runtime/execution'
import { createRenderContext } from '../src/runtime/renderContext'

describe('wrapPageTemplate', () => {
  afterEach(() => {
    setRuntimeExecutionMode('compat')
  })

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

    expect(output).toContain('wx:if="{{typeof __wv_page_layout_name === \'undefined\' || !__wv_page_layout_name || __wv_page_layout_name === \'default\'}}"')
    expect(output).toContain('wx:elif="{{__wv_page_layout_name === \'compact\'}}"')
    expect(output).toContain('title="{{(__wv_page_layout_props&&__wv_page_layout_props.title)}}"')
    expect(output).toContain('subtitle="{{(__wv_page_layout_props&&__wv_page_layout_props.subtitle)}}"')
    expect(output).toContain('<block wx:else><view>page</view></block>')
    expect(output).not.toContain('__wv_page_layout_props&&__wv_page_layout_props.item')
  })

  it.each(['compat', 'strict'] as const)('selects the default layout before native page data defines internal keys (%s)', (mode) => {
    setRuntimeExecutionMode(mode)
    const wrapped = wrapPageTemplate('<view>page</view>', [{
      script: '/layouts/default.ts',
      id: 'layouts/default',
      name: 'default',
      tag: 'layout-default',
    }])
    const branch = parseWxml(wrapped)[0]
    if (branch?.type !== 'element') {
      throw new TypeError('Expected a generated layout branch')
    }
    const condition = branch.attribs['wx:if']!.slice(2, -2)
    const ctx = createRenderContext({} as any, {})
    expect(ctx.eval(condition, {})).toBe(true)
    for (const name of [undefined, '', 'default']) {
      expect(ctx.eval(condition, { [WEVU_PAGE_LAYOUT_NAME_KEY]: name })).toBe(true)
    }
    for (const name of ['compact', '__wv_no_layout']) {
      expect(ctx.eval(condition, { [WEVU_PAGE_LAYOUT_NAME_KEY]: name })).toBe(false)
    }
  })
})
