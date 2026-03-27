import { describe, expect, it } from 'vitest'
import {
  ALIPAY_TEMPLATE_EXTENSION_MAP,
  containsIncompatibleAlipayTemplateSyntax,
  rewriteAlipayReferenceExtensions,
  rewriteTemplateImportExtensionsForAlipay,
  transformTemplateForAlipay,
} from './builder/alipayTemplate'

describe('alipay npm builder template helpers', () => {
  it('exposes the extension map used by alipay template normalization', () => {
    expect(ALIPAY_TEMPLATE_EXTENSION_MAP).toEqual({
      '.wxml': '.axml',
      '.wxss': '.acss',
      '.wxs': '.sjs',
    })
  })

  it('detects template syntax that still requires alipay normalization', () => {
    expect(containsIncompatibleAlipayTemplateSyntax('<view wx:if="{{ok}}" else></view>')).toBe(true)
    expect(containsIncompatibleAlipayTemplateSyntax('<wxs module="helper" src="./helper.wxs" />')).toBe(true)
    expect(containsIncompatibleAlipayTemplateSyntax('<view a:if="{{ok}}"></view>')).toBe(false)
  })

  it('rewrites import/include template references only when they target template files', () => {
    expect(
      rewriteTemplateImportExtensionsForAlipay('<import src="./cell.wxml" /><include src="./panel.html" /><import src="./helper.sjs" />'),
    ).toBe('<import src="./cell.axml" /><include src="./panel.axml" /><import src="./helper.sjs" />')
  })

  it('rewrites cross-file reference extensions across template/style/script payloads', () => {
    expect(
      rewriteAlipayReferenceExtensions('@import "./cell.wxss";<import src="./card.wxml" /><import-sjs from="./helper.wxs" name="helper" />'),
    ).toBe('@import "./cell.acss";<import src="./card.axml" /><import-sjs from="./helper.sjs" name="helper" />')
  })

  it('transforms wx syntax, template imports and wxs imports into alipay-compatible template code', () => {
    expect(
      transformTemplateForAlipay('<view wx:if="{{ok}}" else><wxs module="helper" src="./helper.wxs"/></view><import src="./cell.wxml" />'),
    ).toBe('<view a:if="{{ok}}" a:else><import-sjs name="helper" from="./helper.sjs"/></view><import src="./cell.axml" />')
  })
})
