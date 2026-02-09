import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { compileVueTemplateToWxml, getClassStyleWxsSource } from 'wevu/compiler'
import { transformScript } from '../../src/plugins/vue/transform'

describe('class/style runtime', () => {
  it('emits WXS helper when runtime is wxs', () => {
    const result = compileVueTemplateToWxml(
      `<view class="card" :class="['on', { active: true }]" :style="[{ 'font-size': '12px' }]" v-show="visible" />`,
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

  it('generates wxs helper with cjs export and wxs-compatible syntax', () => {
    const source = getClassStyleWxsSource()

    expect(source).not.toContain('hyphenateRE')
    expect(source).not.toContain('/\\B([A-Z])/g')
    expect(source).not.toContain('for (var key in')
    expect(source).not.toContain('for (var k in')
    expect(source).not.toContain('Object.')
    expect(source).not.toContain('Object.prototype')
    expect(source).toContain('function stylePair')
    expect(source).toContain('function isUpperCaseCode')
    expect(source).toContain('typeof Array !== \'undefined\'')
    expect(source).toContain('Array.isArray')
    expect(source).toContain('String.fromCharCode')
    expect(source).toContain('module.exports = {')
    expect(source).not.toContain('export default {')
  })

  it('generates sjs helper with export default and sjs-safe syntax', () => {
    const source = getClassStyleWxsSource({ extension: 'sjs' })

    expect(source).not.toContain('module.exports = {')
    expect(source).toContain('export default {')
    expect(source).not.toContain('typeof Array')
    expect(source).not.toContain('Array.isArray')
    expect(source).not.toContain('String.fromCharCode')
    expect(source).toContain('toString.call(value) === \'[object Array]\'')
  })

  it('rewrites class object literals for WXS runtime', () => {
    const result = compileVueTemplateToWxml(
      `<view :class="{ 'demo-active': isActive }" />`,
      'test.vue',
      {
        classStyleRuntime: 'wxs',
        wxsExtension: 'wxs',
      },
    )

    expect(result.code).toContain('class="{{__weapp_vite.cls(')
    expect(result.code).toContain('isActive?\'demo-active\':\'\'')
    expect(result.code).not.toContain('__weapp_vite.cls({')
  })

  it('supports object and array values in generated WXS runtime helpers', () => {
    const source = getClassStyleWxsSource()
    const sandbox: Record<string, any> = {
      module: { exports: {} },
      exports: {},
    }

    vm.runInNewContext(source, sandbox)

    const runtime = sandbox.module.exports as {
      cls: (value: unknown) => string
      style: (value: unknown) => string
    }

    const objectCtor = ({}).constructor as { keys?: ((obj: object) => string[]) | undefined }
    const originalObjectKeys = objectCtor.keys
    const originalArrayIsArray = Array.isArray

    objectCtor.keys = undefined
    ;(Array as any).isArray = undefined

    try {
      expect(runtime.cls([
        'base',
        { active: true, disabled: false },
        ['nested', { ready: true }],
      ])).toBe('base active nested ready')

      expect(runtime.style([
        'color:#111111',
        { fontSize: '28rpx', lineHeight: 1.6 },
        [{ opacity: 0.88 }, { '--token': '#4c6ef5' }],
      ])).toBe('color:#111111;font-size:28rpx;line-height:1.6;opacity:0.88;--token:#4c6ef5')
    }
    finally {
      objectCtor.keys = originalObjectKeys
      ;(Array as any).isArray = originalArrayIsArray
    }
  })
  it('rewrites style object literals for WXS runtime', () => {
    const result = compileVueTemplateToWxml(
      `<view :style="{ 'font-size': size }" />`,
      'test.vue',
      {
        classStyleRuntime: 'wxs',
        wxsExtension: 'wxs',
      },
    )

    expect(result.code).toContain('style="{{__weapp_vite.style(')
    expect(result.code).toContain('__weapp_vite.stylePair(\'font-size\',size)')
    expect(result.code).not.toContain('\'font-size\':')
  })

  it('keeps v-for list expression for JS fallback bindings in wxs mode', () => {
    const templateResult = compileVueTemplateToWxml(
      `<view v-for="tab in groupTabs" class="group-tab" :class="tab.key === activeGroup ? 'group-tab-active' : ''" />`,
      'test.vue',
      {
        classStyleRuntime: 'wxs',
        wxsExtension: 'wxs',
      },
    )

    expect(templateResult.code).toContain('class="{{__wv_cls_0[index]}}"')
    expect(templateResult.code).not.toContain('__weapp_vite.cls(')
    expect(templateResult.classStyleBindings?.length).toBe(1)
    expect(templateResult.classStyleBindings?.[0]?.forStack?.[0]?.listExpAst).toBeTruthy()

    const scriptResult = transformScript('export default {}', {
      classStyleRuntime: 'wxs',
      classStyleBindings: templateResult.classStyleBindings ?? [],
    })

    expect(scriptResult.code).toContain('__wv_list_0 = this.groupTabs')
    expect(scriptResult.code).toContain('try')
    expect(scriptResult.code).toContain('catch')
  })

  it('guards v-for list evaluation when props alias is unavailable', () => {
    const templateResult = compileVueTemplateToWxml(
      `<view v-for="item in props.highlights" :class="item.done ? 'on' : ''" />`,
      'test.vue',
      {
        classStyleRuntime: 'wxs',
        wxsExtension: 'wxs',
      },
    )

    const scriptResult = transformScript('export default {}', {
      classStyleRuntime: 'wxs',
      classStyleBindings: templateResult.classStyleBindings ?? [],
    })

    expect(scriptResult.code).toContain('try')
    expect(scriptResult.code).toContain('__wv_list_0 = this.props.highlights')
    expect(scriptResult.code).toContain('catch')
    expect(scriptResult.code).toContain('__wv_list_0 = []')
  })
})
