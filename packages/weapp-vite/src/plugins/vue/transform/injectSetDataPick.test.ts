import { describe, expect, it } from 'vitest'
import { getWxmlDirectivePrefix } from '../../../platform'
import { collectSetDataPickKeysFromTemplate, injectSetDataPickInJs, mayNeedInjectSetDataPickInJs } from './injectSetDataPick'

const DEFAULT_WXML_DIRECTIVE_PREFIX = getWxmlDirectivePrefix()

describe('inject setData.pick', () => {
  it('collects top-level keys from template expressions and skips loop aliases', () => {
    const template = `
<view ${DEFAULT_WXML_DIRECTIVE_PREFIX}:for="{{ list }}" ${DEFAULT_WXML_DIRECTIVE_PREFIX}:for-item="row" ${DEFAULT_WXML_DIRECTIVE_PREFIX}:for-index="i">
  <text>{{ row.name }}</text>
  <text>{{ __wv_bind_0[i] }}</text>
</view>
<text>{{ count > 0 ? count : 0 }}</text>
    `.trim()

    const keys = collectSetDataPickKeysFromTemplate(template)
    expect(keys).toEqual(['__wv_bind_0', 'count', 'list'])
  })

  it('injects setData.pick into wevu component options', () => {
    const source = `
import { createWevuComponent } from 'wevu'
const __wevuOptions = {
  setup() {
    return {}
  },
}
createWevuComponent(__wevuOptions)
    `.trim()

    const injected = injectSetDataPickInJs(source, ['count', 'total'])
    expect(injected.transformed).toBe(true)
    expect(injected.code).toContain('setData')
    expect(injected.code).toContain('pick')
    expect(injected.code).toContain('"count"')
    expect(injected.code).toContain('"total"')
  })

  it('detects whether js may need setData.pick injection', () => {
    expect(mayNeedInjectSetDataPickInJs('createWevuComponent(options)')).toBe(true)
    expect(mayNeedInjectSetDataPickInJs('defineComponent({})')).toBe(true)
    expect(mayNeedInjectSetDataPickInJs('Page({})')).toBe(false)
  })

  it('merges with existing setData.pick array', () => {
    const source = `
import { defineComponent } from 'wevu'
defineComponent({
  setData: {
    strategy: 'patch',
    pick: ['count'],
  },
  setup() {
    return {}
  },
})
    `.trim()

    const injected = injectSetDataPickInJs(source, ['list', 'count'])
    expect(injected.transformed).toBe(true)
    expect(injected.code).toContain('strategy: \'patch\'')
    expect(injected.code).toMatch(/['"]count['"]/)
    expect(injected.code).toMatch(/['"]list['"]/)
  })

  it('wraps non-object setData with spread and pick', () => {
    const source = `
import { defineComponent } from 'wevu'
const setDataOption = getSetDataConfig()
defineComponent({
  setData: setDataOption,
  setup() {
    return {}
  },
})
    `.trim()

    const injected = injectSetDataPickInJs(source, ['count'])
    expect(injected.transformed).toBe(true)
    expect(injected.code).toContain('setData: {')
    expect(injected.code).toContain('pick: ["count"]')
    expect(injected.code).toContain('...setDataOption')
  })

  it('returns original js when no wevu component call hint exists', () => {
    const source = 'Page({ data: { count: 1 } })'
    const injected = injectSetDataPickInJs(source, ['count'])

    expect(injected.transformed).toBe(false)
    expect(injected.code).toBe(source)
  })
})
