/* eslint-disable no-template-curly-in-string -- 用例刻意包含待解析源码的模板字符串。 */
import { describe, expect, it } from 'vitest'
import { getLanguageProfile, languageProfiles, resolveLanguageProfile } from '../profiles'
import { LanguageError } from '../types'
import { analyzeTemplate, formatTemplate, formatTemplateResult, getTemplateExpressions, getTemplateScriptInput } from './index'

describe('platform template contracts', () => {
  it.each(languageProfiles)('preserves $platform syntax and resolves local loop ranges', (profile) => {
    const { directives } = profile
    const event = profile.events.style === 'alipay' ? 'onTap' : 'bind:tap'
    const fileName = `src/page${profile.templateExtensions[0]}`
    const source = `<view   ${directives.for}="{{ rows }}" ${directives.forItem}="row" ${directives.forIndex}="pos" ${directives.key}="id" ${event}="select"><text>  {{ row.title }}  </text></view>\r\n`
    const analysis = analyzeTemplate({ source, fileName })
    expect(analysis.valid).toBe(true)
    expect(analysis.platform).toBe(profile.platform)
    expect(analysis.scopes[0].bindings.map(binding => binding.name)).toEqual(['row', 'pos'])
    for (const binding of analysis.scopes[0].bindings) {
      expect(source.slice(binding.start, binding.end)).toBe(binding.name)
      expect(source.slice(binding.collection.start, binding.collection.end)).toBe('rows')
    }
    expect(analysis.references.find(reference => reference.kind === 'event')?.name).toBe('select')
    const formatted = formatTemplate(source, fileName, { printWidth: 50 })
    expect(formatted).toContain('<text>  {{ row.title }}  </text>')
    expect(formatted.endsWith('\r\n')).toBe(true)
    expect(formatTemplate(formatted, fileName, { printWidth: 50 })).toBe(formatted)
  })

  it('keeps language-only profiles separate from build support', () => {
    expect(languageProfiles.filter(profile => profile.support === 'core').map(profile => profile.platform)).toEqual(['weapp', 'alipay', 'swan', 'tt', 'jd', 'xhs'])
    expect(languageProfiles.filter(profile => profile.support === 'language-only').map(profile => profile.platform)).toEqual(['qq', 'ks', 'ty'])
  })

  it('applies defaults after unique native extensions and explicit overrides before defaults', () => {
    expect(resolveLanguageProfile('pages/page.axml', { defaultPlatform: 'weapp' })?.platform).toBe('alipay')
    expect(resolveLanguageProfile('pages/page.sjs', { defaultPlatform: 'swan' })?.platform).toBe('swan')
    expect(resolveLanguageProfile('pages/page.sjs')).toBeUndefined()
    expect(resolveLanguageProfile('src\\alipay\\page.sjs', { platform: 'weapp', overrides: [{ files: ['**/alipay/**'], platform: 'alipay' }] })?.platform).toBe('alipay')
    expect(analyzeTemplate({ source: '<view/>', fileName: 'page.axml', platform: 'tt', options: { platform: 'alipay' } }).platform).toBe('tt')
  })

  it('recognizes Baidu inline loop bindings and nested shadowing', () => {
    const source = '<view s-for="row,pos in rows"><view s-for="{{ row.children }}" s-for-item="row">{{ row.name }}</view></view>'
    const result = analyzeTemplate({ source, fileName: 'page.swan' })
    expect(result.valid).toBe(true)
    expect(result.scopes).toHaveLength(2)
    expect(result.scopes[0].bindings.map(binding => binding.name)).toEqual(['row', 'pos'])
    expect(result.scopes[1].bindings[0].collection.source).toBe('row.children')
    expect(result.scopes[1].start).toBeGreaterThan(result.scopes[0].start)
    expect(result.scopes[1].end).toBeLessThan(result.scopes[0].end)
  })

  it('extracts template/module imports, declarations and exact UTF-16 ranges', () => {
    const source = '😀<import src="./parts.axml"/><include src="./body.axml"/><template name="row"><view/></template><template is="row"/><import-sjs name="helper" from="./helpers.sjs"/>'
    const result = analyzeTemplate({ source, fileName: 'page.axml' })
    expect(result.references.map(reference => reference.kind)).toEqual(['template-import', 'template-include', 'template-name', 'template-use', 'script-module', 'script-import'])
    for (const reference of result.references) {
      expect(source.slice(reference.start, reference.end)).toBe(reference.name)
    }
  })

  it('recognizes relative typed Filter and module source files as compiled inputs', () => {
    const source = '<filter src="./tools.filter.ts" module="tools"/>'
    const result = analyzeTemplate({ source, fileName: 'page.swan' })
    expect(result.valid).toBe(true)
    expect(result.references.find(reference => reference.kind === 'script-import')).toMatchObject({ source: './tools.filter.ts', sourceKind: 'compiled', language: 'typescript' })
    expect(() => formatTemplate(source, 'page.swan')).not.toThrow()
    expect(analyzeTemplate({ source: '<wxs src="./tools.wxs.ts" module="tools"/>', fileName: 'page.wxml' }).references.find(reference => reference.kind === 'script-import')).toMatchObject({ sourceKind: 'compiled', language: 'typescript' })
  })

  it.each([
    ['wxs', undefined, 'native', 'wxs', 'wxs'],
    ['ks', undefined, 'native', 'ks', 'ks'],
    ['import-sjs', undefined, 'native', 'sjs', 'sjs'],
    ['filter', undefined, 'native', 'javascript', 'filter.js'],
    ['script', 'typescript', 'compiled', 'javascript', 'ts'],
    ['wxs', 'typescript', 'compiled', 'wxs', 'wxs.ts'],
    ['filter', 'typescript', 'compiled', 'javascript', 'filter.ts'],
  ] as const)('shares virtual input for %s / %s', (tagName, language, sourceKind, dialect, extension) => {
    const input = getTemplateScriptInput('page.wxml', { tagName, source: 'var value = 1', start: 10, end: 23, sourceKind, language }, 'swan')
    expect(input).toEqual({ fileName: `page.wxml.${extension}`, source: 'var value = 1', sourceKind, language, dialect, platform: 'swan' })
  })
})

describe('lossless layout', () => {
  const protectedSources = [
    '<view><text>A</text> <text>B</text></view>',
    '<view>  多行\r\n text  {{ value }}  </view>\r\n',
    '<custom-label>prefix  {{ "<view/>" }}  suffix</custom-label>',
    '<view a="&amp;&#32;" a=raw empty="" disabled></view>',
    '<image></image><input/><x:Widget data-name=plain />',
    '\uFEFF<!-- keep  \r\n --><![CDATA[ <view>   text ]]><view/>',
    '<?xml version="1.0"?><!DOCTYPE view [<!ENTITY x "a>b">]><view/>',
    '<view value="{{ { x: [1, 2], nested: { ok: true } } }}"/>',
    '<view value="{{ /[}]{2}/g.test(value) ? `x${{ x: "}}" }.x}` : a / b }}"/>',
    '<view value="{{ counter++ / 2 > 1 ? /}}/.test(value) : 0 }}"/>',
    '<view {{ spread }} class = \'test\' data-object="{{ {a: \'<view>\'} }}"/>',
    '<view foo="line 1\nline 2"/>',
  ]

  it.each(protectedSources)('retains protected source slices: %s', (source) => {
    const result = formatTemplate(source, 'page.wxml', { printWidth: 30 })
    const input = analyzeTemplate({ source, fileName: 'page.wxml' })
    const output = analyzeTemplate({ source: result, fileName: 'page.wxml' })
    expect(output.valid).toBe(true)
    const protectedText = (text: string, analysis: typeof input) => analysis.tokens.filter(token => token.kind !== 'tag').map(token => text.slice(token.start, token.end))
    expect(protectedText(result, output)).toEqual(protectedText(source, input))
    expect(formatTemplate(result, 'page.wxml', { printWidth: 30 })).toBe(result)
  })

  it.each(['wxs', 'sjs', 'ks', 'filter', 'script'])('preserves %s bodies containing fake markup and closing tags', (tag) => {
    const script = `var marker = "</${tag}><view/>"; var regex = /<view>/; /* </${tag}> */ module.exports = { marker: marker };`
    const source = `<${tag}   lang="js" module="helper">${script}</${tag}><view   class="page"/>`
    const result = formatTemplate(source, 'page.wxml')
    expect(result).toContain(`>${script}</${tag}>`)
    expect(analyzeTemplate({ source, fileName: 'page.wxml' }).scripts[0].source).toBe(script)
  })

  it('preserves WXS trailing comment syntax up to the actual closing tag', () => {
    const source = '<wxs module="tools">module.exports = {}; /* trailing comment</wxs><view/>'
    expect(formatTemplate(source)).toBe(source.replace('<view/>', '<view />'))
  })

  it('supports shared layout options without changing existing text line endings', () => {
    const source = '<view a="one" b="two"></view>\r\n'
    const result = formatTemplate(source, 'page.wxml', { singleAttributePerLine: true, bracketSameLine: true, indent: '\t', endOfLine: 'lf' })
    expect(result).toBe('<view\n\ta="one"\n\tb="two"></view>\r\n')
  })

  it('provides expression ranges without truncating quoted delimiters or inspecting opaque content', () => {
    const source = '<!-- {{ ignored }} --><view a="{{ \'}}\' + value }}">{{ `x${{a: "}}"}.a}` }}</view><wxs module="x">var a="{{ignored}}"</wxs>'
    const expressions = getTemplateExpressions(source)
    expect(expressions.map(expression => expression.source)).toEqual([' \'}}\' + value ', ' `x${{a: "}}"}.a}` '])
    for (const expression of expressions) {
      expect(source.slice(expression.start, expression.end)).toBe(expression.source)
      expect(source.slice(expression.fullStart, expression.fullEnd)).toBe(`{{${expression.source}}}`)
    }
  })

  it('uses emitted line widths when adjacent tags follow a newly wrapped tag', () => {
    const source = '<view class="a-very-long-container-name" data-title="long title"><icon type="success" size="23"/></view>'
    const result = formatTemplate(source, 'page.wxml', { printWidth: 60 })
    expect(formatTemplate(result, 'page.wxml', { printWidth: 60 })).toBe(result)
  })

  it('returns original UTF-16 tag edits whose ordered application matches formatted code', () => {
    const source = '😀<view  title="unchanged  value"><text  class="message">  preserved  </text></view>\r\n'
    const result = formatTemplateResult(source, 'page.wxml', { printWidth: 25 })
    let previousEnd = 0
    let applied = ''
    for (const edit of result.edits) {
      expect(edit.start).toBeGreaterThanOrEqual(previousEnd)
      expect(source.slice(edit.start, edit.end)).toMatch(/^<.*>$/s)
      applied += source.slice(previousEnd, edit.start) + edit.newText
      previousEnd = edit.end
    }
    applied += source.slice(previousEnd)
    expect(applied).toBe(result.code)
    expect(result.code).toBe(formatTemplate(source, 'page.wxml', { printWidth: 25 }))
    expect(result.changed).toBe(true)
    const invalid = formatTemplateResult('<view>{{value +}}</view>')
    expect(invalid.code).toBe('<view>{{value +}}</view>')
    expect(invalid.edits).toEqual([])
    expect(invalid.changed).toBe(false)
    expect(invalid.diagnostics[0].severity).toBe('error')
  })

  it.each(['...record, title: title, count', '{ ...record, title }', 'ok ? a : b', '/a/.test(name)', '({x: 1}).x'])('accepts native template object shorthand and expression syntax: %s', (expression) => {
    const source = `<template is="row" data="{{${expression}}}"/><custom-view vendor-directive="literal"/>`
    expect(analyzeTemplate({ source, fileName: 'page.wxml' }).valid).toBe(true)
    expect(() => formatTemplate(source)).not.toThrow()
  })

  it.each(languageProfiles)('accepts adjacent $platform conditional branches and nested loop shadowing', (profile) => {
    const { directives: d } = profile
    const source = `<view ${d.if}="{{a}}"/> <!-- retained --> <view ${d.elif}="{{b}}"/><view ${d.else}/><view ${d.for}="{{rows}}" ${d.forItem}="row"><view ${d.for}="{{row.items}}" ${d.forItem}="row"/></view>`
    expect(analyzeTemplate({ source, fileName: `page${profile.templateExtensions[0]}` }).valid).toBe(true)
  })
})

describe('strict rejection', () => {
  it.each([
    '<view>',
    '<view><text></view></text>',
    '</view>',
    '<view x="unterminated>',
    '<view x=>',
    '<view x="ok"y="bad"/>',
    '<view x="{{ value }"/>',
    '<view>{{ (a] }}</view>',
    '<view>{{ /unterminated }}</view>',
    '<view>{{ a + }}</view>',
    '<view data="{{ }}"/>',
    '<view wx:else/>',
    '<view wx:if="{{ok}}"/><text>intervening</text><view wx:else/>',
    '<view wx:if="{{ok}}"/>text<view wx:elif="{{other}}"/>',
    '<view wx:if="{{ok}}" wx:else/>',
    '<view wx:for="{{rows}}" wx:for="{{others}}"/>',
    '<view wx:for="{{rows}}" wx:for-item="not valid"/>',
    '<view wx:for="{{rows}}" wx:for-item="index"/>',
    '<view wx:for-item="row"/>',
    '<!-- unclosed',
    '<![CDATA[ unclosed',
    '<sjs>var value = "unterminated</sjs>',
  ])('reports an exact error without producing output: %s', (source) => {
    const result = analyzeTemplate({ source, fileName: 'invalid.wxml' })
    expect(result.valid).toBe(false)
    expect(result.diagnostics.some(diagnostic => diagnostic.severity === 'error')).toBe(true)
    expect(() => formatTemplate(source, 'invalid.wxml')).toThrow(LanguageError)
    expect(result.diagnostics.every(diagnostic => diagnostic.start >= 0 && diagnostic.end <= source.length)).toBe(true)
  })

  it.each(['<view s-for="row,bad name in rows"/>', '<view s-for="row,row in rows"/>', '<view s-for="row,pos in rows +"/>', '<view s-if="a +"/>'])('validates Baidu bare expressions and loop declarations: %s', (source) => {
    const result = analyzeTemplate({ source, fileName: 'page.swan' })
    expect(result.valid).toBe(false)
    expect(() => formatTemplate(source, 'page.swan')).toThrow(LanguageError)
  })

  it('does not treat another platform event spelling as a platform-specific event', () => {
    const profile = getLanguageProfile('alipay')
    expect(profile.events.style).toBe('alipay')
    expect(analyzeTemplate({ source: '<view bindtap="tap" onTap="onTap"/>', fileName: 'page.axml' }).references.filter(reference => reference.kind === 'event').map(reference => reference.name)).toEqual(['onTap'])
  })

  it.each([
    '<sjs module="tools">module.exports = {}</sjs>',
    '<wxs>module.exports = {}</wxs>',
    '<wxs module="tools"/><wxs module="tools"/>',
    '<wxs module="tools" src="./tools.wxs">module.exports = {}</wxs>',
  ])('checks native script module ownership and declarations: %s', (source) => {
    expect(analyzeTemplate({ source, fileName: 'page.wxml' }).valid).toBe(false)
    expect(() => formatTemplate(source)).toThrow(LanguageError)
  })

  it('keeps compiled script tags separate from native platform tag constraints', () => {
    expect(analyzeTemplate({ source: '<sjs lang="ts">export const value = 1</sjs>', fileName: 'page.wxml' }).valid).toBe(true)
  })

  it.each(['<filter module="tools" src="tools.js"/>', '<filter module="a" src="./tools.filter.js"/><filter module="b" src="./tools.filter.js"/>'])('checks documented Baidu filter source rules: %s', (source) => {
    expect(analyzeTemplate({ source, fileName: 'page.swan' }).valid).toBe(false)
  })
})
