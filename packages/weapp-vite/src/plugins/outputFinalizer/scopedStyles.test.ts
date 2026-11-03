import type { OutputBundle } from 'rolldown'
import { describe, expect, it } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import { createOutputFinalizerPlugin } from '../outputFinalizer'
import { normalizeClassScopedAssets, normalizeClassScopedStyle, normalizeClassScopedTemplate } from './scopedStyles'

describe('Class-based platform scoped styles', () => {
  it.each([
    { wxml: 'axml', wxss: 'acss' },
    { wxml: 'ttml', wxss: 'ttss' },
  ])('pairs emitted template and style scope markers for $wxml/$wxss', (extensions) => {
    const templateFile = `pages/index/index.${extensions.wxml}`
    const styleFile = `pages/index/index.${extensions.wxss}`
    const bundle = {
      [templateFile]: { type: 'asset', fileName: templateFile, source: '<view data-v-owner="" />' },
      [styleFile]: { type: 'asset', fileName: styleFile, source: '[data-v-owner]{color:red}' },
    } as unknown as OutputBundle
    normalizeClassScopedAssets(bundle, extensions)
    expect((bundle[templateFile] as any).source).toBe('<view class="data-v-owner" data-v-owner="" />')
    expect((bundle[styleFile] as any).source).toBe('.data-v-owner{color:red}')
  })

  it('pairs static, dynamic and slotted scope classes without changing bindings or datasets', () => {
    const source = '<view class="panel {{odd ? \'odd\' : \'\'}}" data-v-owner=""><text data-v-owner="" data-v-child-s="">count</text></view>'
    const template = normalizeClassScopedTemplate(source)
    expect(template).toContain('class="panel {{odd ? \'odd\' : \'\'}} data-v-owner"')
    expect(template).toContain('<text class="data-v-owner data-v-child-s" data-v-owner="" data-v-child-s="">')
    expect(normalizeClassScopedTemplate(template)).toBe(template)
    const style = '.panel.odd[data-v-owner] > text[data-v-child-s]{color:red}.panel[data-v-owner] .deep{color:blue}.global{color:green}'
    expect(normalizeClassScopedStyle(style)).toBe('.panel.odd.data-v-owner > text.data-v-child-s{color:red}.panel.data-v-owner .deep{color:blue}.global{color:green}')
  })

  it('does not rewrite text, comments, declaration strings or unrelated attribute selectors', () => {
    const template = '<!-- data-v-example --><text class="a" data-value="data-v-example">data-v-example</text>'
    expect(normalizeClassScopedTemplate(template)).toBe(template)
    const style = '/* [data-v-owner] */.a[data-value="data-v-owner"]{content:"[data-v-owner]"}.b[data-v-owner="value"]{color:red}'
    expect(normalizeClassScopedStyle(style)).toBe(style)
  })

  it('quotes unquoted classes and preserves independently scoped nodes', () => {
    expect(normalizeClassScopedTemplate('<view class=panel data-v-one=""/><view data-v-two=""/>'))
      .toBe('<view class="panel data-v-one" data-v-one=""/><view class="data-v-two" data-v-two=""/>')
    expect(normalizeClassScopedStyle('.panel[data-v-one],.panel[data-v-two]{color:red}'))
      .toBe('.panel.data-v-one,.panel.data-v-two{color:red}')
  })

  it('preserves quoted class bytes, entity spelling and literal XML backslashes', () => {
    const source = String.raw`<view title="tail\" class='a &quot;b&quot;' data-v-one data-v-two=""/>`
    expect(normalizeClassScopedTemplate(source)).toBe(String.raw`<view title="tail\" class='a &quot;b&quot; data-v-one data-v-two' data-v-one data-v-two=""/>`)
  })

  it('uses the last class attribute independently of earlier quoted or unquoted duplicates', () => {
    expect(normalizeClassScopedTemplate('<view class=first class="last" data-v-one/>'))
      .toBe('<view class=first class="last data-v-one" data-v-one/>')
    expect(normalizeClassScopedTemplate('<view class="first" class=last data-v-one/>'))
      .toBe('<view class="first" class="last data-v-one" data-v-one/>')
    expect(normalizeClassScopedTemplate('<view class data-v-one/>'))
      .toBe('<view class=" data-v-one" data-v-one/>')
  })

  it.each(['alipay', 'tt'] as const)('keeps target %s scripts opaque while traversing ordinary filter components', (platform) => {
    const tag = platform === 'alipay' ? 'import-sjs' : 'sjs'
    const script = `<${tag}>var html = '<view data-v-fake=""/>';</${tag}>`
    const template = `${script}<!-- <view data-v-comment/> --><filter><view data-v-real=""/></filter>`
    expect(normalizeClassScopedTemplate(template, platform))
      .toBe(`${script}<!-- <view data-v-comment/> --><filter><view class="data-v-real" data-v-real=""/></filter>`)
  })

  it('rejects malformed structure before publishing a partial scope rewrite', () => {
    expect(() => normalizeClassScopedTemplate('<view data-v-one><text></view>')).toThrow('[weapp.wxml] 23:')
  })

  it.each(['alipay', 'weapp', 'tt'])('normalizes final output for Alipay and Douyin, including style-only updates (%s)', async (platform) => {
    const styleExt = platform === 'alipay' ? 'acss' : platform === 'tt' ? 'ttss' : 'wxss'
    const filename = `pages/index/index.${styleExt}`
    const runtimeState = createRuntimeState()
    runtimeState.glassEasel.detected = false
    const ctx = {
      configService: { platform, isDev: true, outputExtensions: { wxss: styleExt } },
      runtimeState,
    } as any
    const plugin = createOutputFinalizerPlugin(ctx)
    const hook = plugin.generateBundle
    const handler = typeof hook === 'function' ? hook : hook?.handler
    for (const color of ['red', 'blue']) {
      const bundle = {
        [filename]: { type: 'asset', fileName: filename, source: `.panel[data-v-owner]{color:${color}}` },
      } as unknown as OutputBundle
      await handler?.call({ emitFile() {} } as any, {} as any, bundle, false)
      expect((bundle[filename] as any).source).toBe(platform !== 'weapp'
        ? `.panel.data-v-owner{color:${color}}`
        : `.panel[data-v-owner]{color:${color}}`)
      runtimeState.build.hmr.isRebuild = true
    }
  })
})
