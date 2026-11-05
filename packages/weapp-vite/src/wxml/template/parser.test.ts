import { describe, expect, it } from 'vitest'
import { configuredTemplateParser, outputTemplateParser, platformTemplateParser } from './parser'

describe('bound build template parsers', () => {
  it('keeps compatibility inputs separate from native output tags', () => {
    const source = '<filter><view /></filter>'
    const input = platformTemplateParser('weapp', 'xml').scan(source)
    const output = outputTemplateParser('weapp', 'xml').scan(source)
    expect(input.tokens.filter(token => token.kind === 'tag').map(token => token.name)).toEqual(['filter', 'filter'])
    expect(output.tokens.filter(token => token.kind === 'tag').map(token => token.name)).toEqual(['filter', 'view', 'filter'])
    expect(outputTemplateParser('swan', 'xml').dialect.rawTags).toEqual(['import-sjs', 'filter'])
  })

  it('binds aliases to their platform and retains the AST boundary resolver', () => {
    const source = '<jds module="tools">var value = "</jds><fake/>";</jds><view/>'
    const result = outputTemplateParser('jd', 'xml').scan(source)
    expect(result.diagnostics).toEqual([])
    expect(result.tokens.filter(token => token.kind === 'tag').map(token => token.name)).toEqual(['jds', 'jds', 'view'])
    expect(outputTemplateParser('jd', 'xml').scan('<jds>module.exports = {}; /* trailing </jds><view/>').diagnostics).toEqual([])
    expect(outputTemplateParser('weapp', 'xml').dialect.rawTags).not.toContain('jds')
  })

  it('reuses immutable parser configuration while keeping explicit syntax separate', () => {
    const rawTags = new Set(['custom-script'])
    expect(configuredTemplateParser(rawTags, 'xml')).toBe(configuredTemplateParser(rawTags, 'xml'))
    expect(configuredTemplateParser(rawTags, 'legacy')).not.toBe(configuredTemplateParser(rawTags, 'xml'))
    expect(platformTemplateParser('weapp', 'xml')).toBe(platformTemplateParser('weapp', 'xml'))
    expect(outputTemplateParser('jd', 'xml')).toBe(outputTemplateParser('jd', 'xml'))
    const source = '<custom-script>var value = "<fake/>";</custom-script>'
    const result = configuredTemplateParser(rawTags, 'xml').scan(source)
    expect(result.diagnostics).toEqual([])
    expect(result.tokens.filter(token => token.kind === 'tag').map(token => token.name)).toEqual(['custom-script', 'custom-script'])
  })

  it('rebinds a caller-owned script set after in-place changes', () => {
    const rawTags = new Set(['custom-script'])
    const source = '<custom-script><view/></custom-script>'
    const original = configuredTemplateParser(rawTags, 'xml')
    expect(original.scan(source).tokens.filter(token => token.kind === 'tag').map(token => token.name)).toEqual(['custom-script', 'custom-script'])
    rawTags.delete('custom-script')
    rawTags.add('other-script')
    const changed = configuredTemplateParser(rawTags, 'xml')
    expect(changed).not.toBe(original)
    expect(changed.scan(source).tokens.filter(token => token.kind === 'tag').map(token => token.name)).toEqual(['custom-script', 'view', 'custom-script'])
    expect(original.dialect.rawTags).toEqual(['custom-script'])
  })
})
