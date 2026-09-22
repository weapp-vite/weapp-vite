import type { OutputBundle } from 'rolldown'
import { describe, expect, it } from 'vitest'
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

  it.each(['alipay', 'weapp', 'tt'])('normalizes final output for Alipay and Douyin, including style-only updates (%s)', async (platform) => {
    const styleExt = platform === 'alipay' ? 'acss' : platform === 'tt' ? 'ttss' : 'wxss'
    const filename = `pages/index/index.${styleExt}`
    const ctx = {
      configService: { platform, isDev: true, outputExtensions: { wxss: styleExt } },
      runtimeState: { glassEasel: { detected: false }, build: { output: { emittedSource: new Map() } } },
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
    }
  })
})
