import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { compileVueTemplateToWxml, getClassStyleWxsSource } from 'wevu/compiler'
import { compileVueFile, transformScript } from '../../src/plugins/vue/transform'

function extractComputedEntryFunction(code: string, name: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const keyPattern = new RegExp(`(?:['\"]${escapedName}['\"]|${escapedName})\\s*:\\s*function\\s*\\(`)
  const matched = keyPattern.exec(code)
  const index = matched?.index ?? -1
  if (index < 0) {
    throw new Error(`computed entry not found: ${name}`)
  }
  const fnStartMatch = /function\s*\(/.exec(code.slice(index))
  const fnStart = fnStartMatch ? index + fnStartMatch.index : -1
  if (fnStart < 0) {
    throw new Error(`computed function start not found: ${name}`)
  }
  const bodyStart = code.indexOf('{', fnStart)
  if (bodyStart < 0) {
    throw new Error(`computed function body start not found: ${name}`)
  }
  let depth = 0
  let inSingleQuote = false
  let inDoubleQuote = false
  let inTemplateQuote = false
  let escaping = false
  let end = -1
  for (let i = bodyStart; i < code.length; i += 1) {
    const ch = code[i]
    if (escaping) {
      escaping = false
      continue
    }
    if (ch === '\\') {
      escaping = true
      continue
    }
    if (!inDoubleQuote && !inTemplateQuote && ch === '\'') {
      inSingleQuote = !inSingleQuote
      continue
    }
    if (!inSingleQuote && !inTemplateQuote && ch === '"') {
      inDoubleQuote = !inDoubleQuote
      continue
    }
    if (!inSingleQuote && !inDoubleQuote && ch === '`') {
      inTemplateQuote = !inTemplateQuote
      continue
    }
    if (inSingleQuote || inDoubleQuote || inTemplateQuote) {
      continue
    }
    if (ch === '{') {
      depth += 1
    }
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end < 0) {
    throw new Error(`computed function body end not found: ${name}`)
  }
  return code.slice(fnStart, end + 1)
}

function createTestUnref() {
  return (value: any) => {
    if (value && typeof value === 'object' && 'value' in value) {
      return value.value
    }
    return value
  }
}

function createTestNormalizeClass(unref: (value: any) => any) {
  const normalizeClass = (value: any): string => {
    const unwrapped = unref(value)
    if (!unwrapped) {
      return ''
    }
    if (typeof unwrapped === 'string') {
      return unwrapped
    }
    if (Array.isArray(unwrapped)) {
      return unwrapped.map(item => normalizeClass(item)).filter(Boolean).join(' ')
    }
    if (typeof unwrapped === 'object') {
      return Object.keys(unwrapped).filter(key => Boolean(unref((unwrapped as any)[key]))).join(' ')
    }
    return ''
  }
  return normalizeClass
}

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
    expect(result.code).toContain('style="{{__wv_style_0}}"')
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

    expect(scriptResult.code).toContain('__wv_list_0 = __wevuUnref(__wevuUnref(this.$state')
    expect(scriptResult.code).toContain('Object.prototype.hasOwnProperty.call(this.$state, "groupTabs")')
    expect(scriptResult.code).toContain('__wevuProps.groupTabs')
    expect(scriptResult.code).toContain(': this.groupTabs')
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
    expect(scriptResult.code).toContain('this.__wevuProps != null ? this.__wevuProps : this.props')
    expect(scriptResult.code).toContain('.highlights')
    expect(scriptResult.code).toContain('catch')
    expect(scriptResult.code).toContain('__wv_list_0 = []')
  })

  it('guards script setup root class binding evaluation errors', async () => {
    const source = `
<template>
  <view v-if="root" :class="root.a" />
</template>

<script setup lang="ts">
defineProps<{
  root: { a: string }
}>()
</script>
`

    const result = await compileVueFile(source, 'test.vue', {
      template: {
        classStyleRuntime: 'js',
      },
    })

    expect(result.script).toContain('__wevuNormalizeClass(__wevuUnref(this.$state')
    expect(result.script).toContain('Object.prototype.hasOwnProperty.call(this.$state, "root")')
    expect(result.script).toContain('__wevuProps.root')
    expect(result.script).toContain(': this.root).a')
    expect(result.script).toContain('__wv_expr_err')
    expect(result.script).toContain('catch')
  })

  it('guards non-v-for class expression evaluation errors', () => {
    const templateResult = compileVueTemplateToWxml(
      `<view v-if="root" :class="root.a" />`,
      'test.vue',
      {
        classStyleRuntime: 'js',
      },
    )

    const scriptResult = transformScript('export default {}', {
      classStyleRuntime: 'js',
      classStyleBindings: templateResult.classStyleBindings ?? [],
    })

    expect(scriptResult.code).toContain('__wevuNormalizeClass(__wevuUnref(this.$state')
    expect(scriptResult.code).toContain('Object.prototype.hasOwnProperty.call(this.$state, "root")')
    expect(scriptResult.code).toContain('__wevuProps.root')
    expect(scriptResult.code).toContain(': this.root).a')
    expect(scriptResult.code).toContain('__wv_expr_err')
    expect(scriptResult.code).toContain('catch')
    expect(scriptResult.code).toContain('return ""')
  })

  it('guards v-for item class expression evaluation errors', () => {
    const templateResult = compileVueTemplateToWxml(
      `<view v-for="(event, index) in events" :class="selectedEventIdx === index ? (event.isPublic ? 'on' : 'off') : 'idle'" />`,
      'test.vue',
      {
        classStyleRuntime: 'js',
      },
    )

    const scriptResult = transformScript('export default {}', {
      classStyleRuntime: 'js',
      classStyleBindings: templateResult.classStyleBindings ?? [],
    })

    expect(scriptResult.code).toContain('__wv_list_0.map((event, index) =>')
    expect(scriptResult.code).toContain('event.isPublic ? \'on\' : \'off\'')
    expect(scriptResult.code).toContain('__wv_expr_err')
  })

  it('evaluates nested ternary class with ref/computed-like values in v-for', () => {
    const templateResult = compileVueTemplateToWxml(
      `<cover-view
        v-for="(event, index) in events"
        :class="[
          'base',
          isExpand.callout ? 'expanded' : 'collapsed',
          selectedEventIdx === index ? (event.isPublic ? 'bg-highlight-dark' : 'bg-theme-dark') : 'bg-white',
        ]"
      />`,
      'test.vue',
      {
        classStyleRuntime: 'js',
      },
    )

    const result = transformScript('export default {}', {
      classStyleRuntime: 'js',
      classStyleBindings: templateResult.classStyleBindings ?? [],
    })

    const fnCode = extractComputedEntryFunction(result.code, '__wv_cls_0')
    const unref = createTestUnref()
    const normalizeClass = createTestNormalizeClass(unref)
    const fn = vm.runInNewContext(`(${fnCode})`, {
      __wevuNormalizeClass: normalizeClass,
      __wevuUnref: unref,
    }) as (this: any) => string[]

    const ctx = {
      events: [{ isPublic: true }, { isPublic: false }],
      isExpand: { callout: true },
      selectedEventIdx: { value: 1 },
    }

    const value = fn.call(ctx)
    expect(value[0]).toBe('base expanded bg-white')
    expect(value[1]).toBe('base expanded bg-theme-dark')
  })

  it('evaluates class ternary with computed-like ref boolean value', () => {
    const templateResult = compileVueTemplateToWxml(
      `<view :class="computedValue ? 'a' : 'b'" />`,
      'test.vue',
      {
        classStyleRuntime: 'js',
      },
    )

    const result = transformScript('export default {}', {
      classStyleRuntime: 'js',
      classStyleBindings: templateResult.classStyleBindings ?? [],
    })

    const fnCode = extractComputedEntryFunction(result.code, '__wv_cls_0')
    const unref = createTestUnref()
    const fn = vm.runInNewContext(`(${fnCode})`, {
      __wevuNormalizeClass: (value: any) => unref(value),
      __wevuUnref: unref,
    }) as (this: any) => string

    const whenTrue = fn.call({
      computedValue: { value: true },
    })
    const whenFalse = fn.call({
      computedValue: { value: false },
    })

    expect(whenTrue).toBe('a')
    expect(whenFalse).toBe('b')
  })
})
