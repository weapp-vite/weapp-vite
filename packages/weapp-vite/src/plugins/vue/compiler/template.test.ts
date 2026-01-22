import { describe, expect, it } from 'vitest'
import { compileVueTemplateToWxml, getMiniProgramTemplatePlatform } from './template'

describe('compileVueTemplateToWxml', () => {
  it('rewrites nullish coalescing in bindings', () => {
    const template = `
<t-icon :name="item.icon ?? 'app'" />
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/components/QuickActionGrid/index.vue')

    const normalized = code.replace(/\s/g, '')
    expect(normalized).toContain(`name="{{item.icon!=null?item.icon:'app'}}"`)
    expect(code).not.toContain('??')
  })

  it('emits array-based scoped slot props', () => {
    const template = `
<slot name="item" :item="card.item" :index="card.index" />
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/components/KpiBoard/index.vue')

    expect(code).toContain(`__wv-slot-props="{{['item',card.item,'index',card.index]}}"`)
    expect(code).not.toContain(`__wv-slot-props="{{{`)
  })

  it('emits array-based slot scope mapping', () => {
    const template = `
<Child v-for="(item, index) in list" :key="index">
  <template #default="{ value }">
    <view>{{ value }}</view>
  </template>
</Child>
    `.trim()

    const { code } = compileVueTemplateToWxml(template, '/project/src/pages/index/index.vue')

    expect(code).toContain(`__wv-slot-scope="{{['item',item,'index',index]}}"`)
    expect(code).not.toContain(`__wv-slot-scope="{{{`)
  })

  it.each([
    [
      'weapp',
      {
        ifAttr: 'wx:if',
        elifAttr: 'wx:elif',
        elseAttr: 'wx:else',
        forAttr: 'wx:for',
        keyAttr: 'wx:key',
        eventAttr: 'bindtap',
      },
    ],
    [
      'alipay',
      {
        ifAttr: 'a:if',
        elifAttr: 'a:elif',
        elseAttr: 'a:else',
        forAttr: 'a:for',
        keyAttr: 'a:key',
        eventAttr: 'onTap',
      },
    ],
    [
      'tt',
      {
        ifAttr: 'tt:if',
        elifAttr: 'tt:elif',
        elseAttr: 'tt:else',
        forAttr: 'tt:for',
        keyAttr: 'tt:key',
        eventAttr: 'bindtap',
      },
    ],
    [
      'swan',
      {
        ifAttr: 's-if',
        elifAttr: 's-elif',
        elseAttr: 's-else',
        forAttr: 's-for',
        keyAttr: 's-key',
        eventAttr: 'bindtap',
      },
    ],
    [
      'jd',
      {
        ifAttr: 'wx:if',
        elifAttr: 'wx:elif',
        elseAttr: 'wx:else',
        forAttr: 'wx:for',
        keyAttr: 'wx:key',
        eventAttr: 'bindtap',
      },
    ],
    [
      'xhs',
      {
        ifAttr: 'wx:if',
        elifAttr: 'wx:elif',
        elseAttr: 'wx:else',
        forAttr: 'wx:for',
        keyAttr: 'wx:key',
        eventAttr: 'bindtap',
      },
    ],
  ])('applies platform template attrs for %s', (platform, expected) => {
    const template = `
<view v-if="ok">A</view>
<view v-else-if="other">B</view>
<view v-else>C</view>
<view v-for="(item, index) in list" :key="item.id" @tap="onTap">{{ item.name }}</view>
    `.trim()

    const { code } = compileVueTemplateToWxml(
      template,
      '/project/src/pages/index/index.vue',
      { platform: getMiniProgramTemplatePlatform(platform as any) },
    )

    expect(code).toContain(expected.ifAttr)
    expect(code).toContain(expected.elifAttr)
    expect(code).toContain(expected.elseAttr)
    expect(code).toContain(expected.forAttr)
    expect(code).toContain(expected.keyAttr)
    expect(code).toContain(expected.eventAttr)
  })
})
