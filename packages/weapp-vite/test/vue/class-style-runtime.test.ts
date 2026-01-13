import { describe, expect, it } from 'vitest'
import { compileVueTemplateToWxml } from '../../src/plugins/vue/compiler/template'

describe('class/style runtime', () => {
  it('emits WXS helper when runtime is wxs', () => {
    const result = compileVueTemplateToWxml(
      `<view class="card" :class="[active ? 'on' : '', extra]" :style="[styleObj]" v-show="visible" />`,
      'test.vue',
      {
        classStyleRuntime: 'wxs',
        wxsExtension: 'wxs',
      },
    )

    expect(result.code).toContain('<wxs module="__weapp_vite" src="./__weapp_vite_class_style.wxs"/>')
    expect(result.code).toContain('class="{{__weapp_vite.cls(')
    expect(result.code).toContain('style="{{__weapp_vite.style(')
    expect(result.code).toContain('display: none')
  })

  it('emits JS bindings when runtime is js', () => {
    const result = compileVueTemplateToWxml(
      `<view class="card" :class="[active ? 'on' : '', extra]" :style="[styleObj]" v-show="visible" />`,
      'test.vue',
      {
        classStyleRuntime: 'js',
      },
    )

    expect(result.code).toContain('class="{{__wv_cls_0}}"')
    expect(result.code).toContain('style="{{__wv_style_1}}"')
    expect(result.code).not.toContain('<wxs module="__weapp_vite"')
    expect(result.classStyleRuntime).toBe('js')
    expect(result.classStyleBindings?.length).toBe(2)
    expect(result.classStyleBindings?.every(binding => Boolean(binding.expAst))).toBe(true)
  })

  it('injects v-for index access for JS runtime bindings', () => {
    const result = compileVueTemplateToWxml(
      '<view v-for="item in items" :class="itemClass" />',
      'test.vue',
      {
        classStyleRuntime: 'js',
      },
    )

    expect(result.code).toContain('wx:for-index="__wv_index_0"')
    expect(result.code).toContain('class="{{__wv_cls_0[__wv_index_0]}}"')
  })
})
