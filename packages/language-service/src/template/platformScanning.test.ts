import type { LanguageOptions } from '../types'
import { describe, expect, it } from 'vitest'
import { analyzeDocument } from '../index'
import { languageProfiles } from '../profiles'
import { analyzeTemplate, formatTemplate, formatTemplateResult, getTemplateExpressions, scanTemplate } from './index'

const platformTags = [
  { platform: 'jd', tag: 'jds', extension: '.jxml' },
  { platform: 'qq', tag: 'qs', extension: '.qml' },
] as const

describe.each(platformTags)('$platform template scanner configuration', ({ platform, tag, extension }) => {
  it('shares raw script boundaries across analysis, metadata, document analysis and formatting', () => {
    const script = `var marker = "</${tag}><fake/>{{ignored}}"; /* </${tag}> */ module.exports = { marker: marker };`
    const source = `<${tag}   module="tools">${script}</${tag}><view   class="page">{{value}}</view>`
    const fileName = `page${extension}`
    const analysis = analyzeTemplate({ source, fileName })
    expect(analysis.valid).toBe(true)
    expect(analysis.platform).toBe(platform)
    expect(analysis.elements.map(element => element.name)).toEqual([tag, 'view'])
    expect(analysis.scripts).toEqual([{ tagName: tag, start: source.indexOf(script), end: source.indexOf(script) + script.length, source: script, sourceKind: 'native', language: 'javascript', moduleName: 'tools' }])
    expect(analysis.references.filter(reference => reference.kind === 'script-module').map(reference => reference.name)).toEqual(['tools'])
    expect(analysis.expressions.map(expression => expression.source)).toEqual(['value'])
    expect(analyzeDocument({ source, fileName }).diagnostics).toEqual([])
    const formatted = formatTemplate(source, fileName, { singleAttributePerLine: true })
    expect(formatted).toContain(`>${script}</${tag}>`)
    expect(formatted).not.toContain('<fake />')
    expect(analyzeTemplate({ source: formatted, fileName }).scripts[0]?.source).toBe(script)
    expect(formatTemplate(formatted, fileName, { singleAttributePerLine: true })).toBe(formatted)
  })

  it('uses AST-assisted trailing-comment boundaries in both formatter scans', () => {
    const script = 'module.exports = {}; /* trailing '
    const source = `<${tag} module="tools">${script}</${tag}><view/>`
    const fileName = `page${extension}`
    expect(analyzeTemplate({ source, fileName }).scripts[0]?.source).toBe(script)
    expect(formatTemplate(source, fileName)).toBe(source.replace('<view/>', '<view />'))
  })

  it('records external sources and validates module identity for the actual alias', () => {
    const source = `<${tag} module="tools" src="./tools.${tag}"/>`
    const analysis = analyzeTemplate({ source, fileName: `page${extension}` })
    expect(analysis.valid).toBe(true)
    expect(analysis.references.find(reference => reference.kind === 'script-import')).toMatchObject({ name: `./tools.${tag}`, tagName: tag, sourceKind: 'native', language: 'javascript' })
    expect(analyzeTemplate({ source: `<${tag}/>`, fileName: `page${extension}` }).diagnostics).toContainEqual(expect.objectContaining({ code: 'template/missing-script-module' }))
    expect(analyzeTemplate({ source: `${source}<wxs module="tools"/>`, fileName: `page${extension}` }).diagnostics).toContainEqual(expect.objectContaining({ code: 'template/duplicate-script-module' }))
    expect(analyzeTemplate({ source: `<${tag} module="tools" src="./tools.${tag}">module.exports = {}</${tag}>`, fileName: `page${extension}` }).diagnostics).toContainEqual(expect.objectContaining({ code: 'template/script-source-conflict' }))
  })

  it.each(languageProfiles.filter(profile => profile.platform !== platform))('retains a foreign script name as an ordinary component on $platform', (profile) => {
    const source = `<${tag}   module="component" src="./component"><view   class="child">{{value}}</view></${tag}>`
    const fileName = `page${profile.templateExtensions[0]}`
    const analysis = analyzeTemplate({ source, fileName })
    expect(analysis.valid).toBe(true)
    expect(analysis.elements.map(element => element.name)).toEqual([tag, 'view'])
    expect(analysis.scripts).toEqual([])
    expect(analysis.references.filter(reference => reference.kind.startsWith('script-'))).toEqual([])
    expect(analysis.expressions.map(expression => expression.source)).toEqual(['value'])
    const formatted = formatTemplate(source, fileName)
    expect(formatted).toContain('<view class="child">')
    expect(analyzeTemplate({ source: formatted, fileName }).scripts).toEqual([])
  })

  it.each([
    { platform },
    { defaultPlatform: platform },
    { platform: 'weapp' as const, overrides: [{ files: ['**/vendor/**'], platform }] },
  ] satisfies LanguageOptions[])('selects the same raw context through language options: %j', (options) => {
    const source = `<${tag} module="tools">var marker = "<fake/>";</${tag}>`
    const fileName = 'src/vendor/page.template'
    expect(analyzeTemplate({ source, fileName, options }).scripts).toHaveLength(1)
    expect(formatTemplateResult(source, fileName, options).diagnostics).toEqual([])
    expect(analyzeTemplate({ source, fileName: 'page.wxml', platform, options: { platform: 'weapp' } }).scripts).toHaveLength(1)
  })
})

describe('platform-aware syntax and legacy source safety', () => {
  it('accepts host-confirmed adjacent attributes for WXML and formats them with explicit separators', () => {
    const source = '<view a="1"b=\'2\'bare empty=""duplicate="a"duplicate="b"/>'
    expect(analyzeTemplate({ source, fileName: 'page.wxml' }).valid).toBe(true)
    expect(formatTemplate(source, 'page.wxml', { printWidth: 200 })).toBe('<view a="1" b=\'2\' bare empty="" duplicate="a" duplicate="b" />')
    expect(scanTemplate(source).diagnostics).toEqual([])
    expect(analyzeTemplate({ source, fileName: 'page.wxml', options: { syntax: 'xml' } }).valid).toBe(true)
    expect(formatTemplateResult(source, 'page.wxml', { syntax: 'xml' }).diagnostics).toEqual([])
    expect(analyzeTemplate({ source, fileName: 'page.axml' }).valid).toBe(true)
    expect(analyzeTemplate({ source, fileName: 'page.axml', options: { syntax: 'legacy' } }).valid).toBe(true)
  })

  it('uses explicit syntax to select host escape behavior without changing platform identity', () => {
    const source = String.raw`<view path="tail\"/>`
    expect(analyzeTemplate({ source, fileName: 'page.wxml' }).valid).toBe(false)
    expect(analyzeTemplate({ source, fileName: 'page.wxml', options: { syntax: 'xml' } })).toMatchObject({ platform: 'weapp', valid: true })
    expect(formatTemplateResult(source, 'page.wxml', { syntax: 'xml' }).diagnostics).toEqual([])
    expect(analyzeTemplate({ source, fileName: 'page.axml' }).valid).toBe(true)
    expect(analyzeTemplate({ source, fileName: 'page.axml', options: { syntax: 'legacy' } })).toMatchObject({ platform: 'alipay', valid: false })
    expect(formatTemplateResult(source, 'page.axml', { syntax: 'legacy' })).toMatchObject({ code: source, changed: false, edits: [] })
  })

  it('keeps legacy attribute escapes and expression ranges unchanged while validating the decoded view', () => {
    const source = String.raw`<view   title="path\\file \"quoted\""data-value="{{ ({ label: \"}}\", value: value }).label }}"bindtap="tap">{{value}}</view>`
    const analysis = analyzeTemplate({ source, fileName: 'page.wxml' })
    expect(analysis.diagnostics).toEqual([])
    expect(analysis.expressions.map(expression => expression.source)).toEqual([String.raw` ({ label: \"}}\", value: value }).label `, 'value'])
    for (const expression of analysis.expressions) {
      expect(source.slice(expression.start, expression.end)).toBe(expression.source)
      expect(source.slice(expression.fullStart, expression.fullEnd)).toBe(`{{${expression.source}}}`)
    }
    const formatted = formatTemplate(source, 'page.wxml', { singleAttributePerLine: true })
    const output = analyzeTemplate({ source: formatted, fileName: 'page.wxml' })
    expect(output.diagnostics).toEqual([])
    expect(output.elements[0].attributes.map(attribute => attribute.rawValue)).toEqual(analysis.elements[0].attributes.map(attribute => attribute.rawValue))
    expect(output.expressions.map(expression => expression.source)).toEqual(analysis.expressions.map(expression => expression.source))
    expect(formatTemplate(formatted, 'page.wxml', { singleAttributePerLine: true })).toBe(formatted)
  })

  it('maps AST errors after legacy escapes to the original UTF-16 source', () => {
    const source = String.raw`😀<view value="{{ \"ok\" + @ }}"/>`
    const analysis = analyzeTemplate({ source, fileName: 'page.wxml' })
    expect(analysis.diagnostics).toContainEqual(expect.objectContaining({ code: 'template/invalid-expression', start: source.indexOf('@'), end: source.indexOf('@') + 1 }))
    expect(formatTemplateResult(source, 'page.wxml')).toMatchObject({ code: source, changed: false, edits: [] })
  })

  it('keeps unprofiled expressions and literal XML backslashes on their original compatibility path', () => {
    const source = String.raw`<view path="tail\" value="{{ fn(&quot;}}&quot;) }}"/>`
    const xml = analyzeTemplate({ source, fileName: 'unknown.template' })
    expect(xml.tokens).toEqual(scanTemplate(source).tokens)
    expect(xml.expressions).toEqual(getTemplateExpressions(source))
    expect(analyzeTemplate({ source: '<view value="{{ "text" }}"/>', fileName: 'page.wxml' }).valid).toBe(false)
  })

  it('preserves compiled compatibility raw tags after selecting a core platform', () => {
    const source = '<ks lang="js">var marker = "<fake/>";</ks>'
    expect(analyzeTemplate({ source, fileName: 'page.wxml' }).scripts[0]?.source).toBe('var marker = "<fake/>";')
    expect(formatTemplateResult(source, 'page.wxml').diagnostics).toEqual([])
  })
})
