import type { EditSession, NodeEdits } from './edit/state'
/* eslint-disable no-template-curly-in-string -- 词法样本包含待解析的模板字符串插值。 */
import type { Document, ElementNode, ParseOptions } from './types'
import { describe, expect, it } from 'vitest'
import { attributeSourceError, legacyAttributeSource } from './attributeLayer'
import { TokenContext } from './context'
import { createPatchedDocument } from './edit/document'
import { edit } from './edit/index'
import { EditableHandle } from './edit/node'
import { renderEdits } from './edit/output'
import { parseRawEdits } from './edit/raw'
import { expressionEnd, interpolations, validateLegacyAttribute } from './expression'
import { isSpaceCode, TemplateLexicalError } from './lexical'
import { parse } from './parser'
import { scan, scanComments } from './scanner'
import { findScriptClosingTag, findTrailingScriptComment, scanScriptBoundaryCandidates } from './script'
import { serialize } from './serialize'
import { readTag } from './tag'
import { walk } from './walk'

function session(document: Document, node?: ElementNode, changes?: Partial<NodeEdits>): EditSession {
  return { document, active: true, hasStructuralInvalidations: false, edits: new Map(node ? [[node, { removed: false, ...changes }]] : []) }
}

describe('source boundary and defensive contracts', () => {
  it('preserves unexpected host failures instead of disguising them as syntax errors', () => {
    const failure = new Error('consumer resolver failed')
    expect(() => attributeSourceError(legacyAttributeSource('value', 0, 5), failure)).toThrow(failure)
    expect(() => scan('<wxs>value</wxs>', { resolveScriptBoundary: () => {
      throw failure
    } })).toThrow(failure)
  })

  it.each([null, [], 1, 'xml'])('rejects invalid parse option objects: %j', (options) => {
    expect(() => parse('<view/>', options as never)).toThrow(TypeError)
    expect(() => scan('<view/>', options as never)).toThrow(TypeError)
  })

  it('rejects invalid visitors, literal values and snippet source types', () => {
    expect(() => edit(parse('<view/>'), null as never)).toThrow(TypeError)
    expect(() => edit(parse('text'), handle => handle.replaceText({ expression: '' }))).toThrow(TypeError)
    expect(() => edit(parse('text'), handle => handle.replaceText(null as never))).toThrow(TypeError)
    expect(() => edit(parse('<view/>'), handle => handle.insertBefore(null as never))).toThrow(TypeError)
    expect(() => edit(parse('text'), handle => handle.prepend('<view/>'))).toThrow('element node')
    expect(() => edit(parse('text'), handle => handle.append('<view/>'))).toThrow('element node')
  })

  it('parses declarations with internal subsets and quoted greater-than delimiters', () => {
    const source = '<!DOCTYPE view [<!ENTITY a "one>two"><!ENTITY b \'three>four\'>]><view/>'
    expect(parse(source).diagnostics).toEqual([])
    expect(parse(source).tokens[0]).toMatchObject({ kind: 'declaration', end: source.indexOf('<view/>') })
    expect(parse('<!DOCTYPE view [<!ENTITY a "value">]').diagnostics).toMatchObject([{ code: 'template/invalid-syntax', start: 0 }])
    expect(parse('<?tool unfinished').diagnostics).toMatchObject([{ code: 'template/invalid-syntax', start: 0 }])
    expect(parse('<![CDATA[ unfinished').diagnostics).toMatchObject([{ code: 'template/invalid-syntax', start: 0 }])
  })

  it.each(['<>', '</view/>', '</view attr>', '<view a="x"b"c>', '<view a\'b>', '<view =>', '<view a=/>', '<view a='])('rejects malformed standalone tags: %s', (source) => {
    expect(() => readTag(source, 0)).toThrow(TemplateLexicalError)
  })

  it('preserves standalone spread-shaped attribute names and rejects unfinished tag names', () => {
    const spread = readTag('<view {{spread}}/>', 0).attributes
    expect(spread).toMatchObject([{ name: '{{spread}}' }])
    expect(spread[0]?.value).toBeUndefined()
    expect(readTag('<view {literal}/>', 0).attributes[0]?.name).toBe('{literal}')
    expect(() => readTag('<view', 0)).toThrow('未闭合的标签')
  })

  it('rejects a script resolver pointing at an unrelated or opening tag', () => {
    for (const source of ['<wxs>value</other>', '<wxs>value<other/>']) {
      const start = source.indexOf('<', 5)
      const options: ParseOptions = { resolveScriptBoundary: () => ({ start, end: source.length }) }
      expect(parse(source, options).diagnostics).toMatchObject([{ code: 'template/invalid-syntax', start }])
    }
  })

  it('distinguishes every supported whitespace family from nearby nonspace characters', () => {
    for (const code of [9, 10, 11, 12, 13, 32, 0xA0, 0x1680, 0x2000, 0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF]) {
      expect(isSpaceCode(code), String(code)).toBe(true)
    }
    for (const code of [0, 8, 14, 31, 33, 0xA1, 0x167F, 0x200B, 0xFEFE, Number.NaN]) {
      expect(isSpaceCode(code), String(code)).toBe(false)
    }
  })

  it('supports readonly root arrays and skip-descendant traversal', () => {
    const document = parse('<root><child/></root><outside/>')
    const entries: string[] = []
    walk(document.children, { enter(node) {
      entries.push(node.kind === 'element' ? node.name : node.kind)
      return false
    } })
    expect(entries).toEqual(['root', 'outside'])
  })
})

describe('incomplete lexical fragments', () => {
  it.each(['{{ &#x; }}', '{{ &#; }}', '{{ &#xyz; }}', '{{ &anextremelylongentityname; }}', '{{ &quot }}'])('does not mistake entity-like operators for encoded quotes: %s', (source) => {
    expect(expressionEnd(source, 0)).toBe(source.length)
  })

  it('reports invalid nested brackets, regular expressions and escaped host bindings', () => {
    expect(() => expressionEnd('{[)}', 0, false)).toThrow('不匹配')
    expect(() => expressionEnd('{{ /unterminated\n }}', 0)).toThrow('正则')
    expect(() => expressionEnd('{{ // unterminated }}', 0)).toThrow('未闭合的插值表达式')
    expect(() => validateLegacyAttribute('prefix{{(value}}', 0, 16)).toThrow('不匹配')
    expect(() => interpolations('{{(value}}', 'legacy', '"')).toThrow('不匹配')
    const source = '{{value}}'
    expect(expressionEnd(source, 0, true, 'legacy', '"')).toBe(source.length)
    expect(expressionEnd(`${source}"tail`, 0, true, 'legacy', '"')).toBe(source.length)
    expect(interpolations(`${source}"tail`, 'legacy', '"')).toEqual([{ start: 0, end: source.length }])
  })

  it.each(['"unterminated', '\'unterminated', '`unterminated', '`escaped\\`', '`value ${ 1', '/unterminated', '/unterminated\n', '/[a\\]]/gi', '/[unterminated', '/escaped\\/', '</other>', 'value++\nvalue--'])('terminates lexical helper scans safely at EOF: %s', (source) => {
    expect(findTrailingScriptComment(source)).toBeUndefined()
    expect(scanScriptBoundaryCandidates(source, 0, 'wxs').closingTag).toBeUndefined()
  })

  it('keeps escaped strings, templates and regular expression character classes opaque', () => {
    const body = 'const a="escaped\\\"</wxs>";const b=`escaped\\` </wxs> ${1}`;const c=/[\\]a]/gi;'
    const source = `<wxs>${body}</wxs>`
    expect(findScriptClosingTag(source, 5, 'wxs')?.start).toBe(source.lastIndexOf('</wxs>'))
    expect(findTrailingScriptComment('/* unterminated')).toBe(0)
    expect(findScriptClosingTag('value</wxs extra>', 0, 'wxs')).toBeUndefined()
    expect(scanComments('<view>text</view>')).toEqual({ tokens: [], diagnostics: [] })
  })

  it('does not promote an incomplete nested function header into a completed outer header', () => {
    const context = new TokenContext(true)
    context.word('function', 0, 8)
    context.punctuation(40)
    context.word('function', 0, 8)
    context.punctuation(40)
    context.punctuation(41)
    expect(context.punctuation(41)).toBe(true)
    expect(context.depth).toBe(0)
  })
})

describe('controlled editing of externally supplied document views', () => {
  it('keeps source gaps around an explicitly selected tree intact', () => {
    const parsed = parse('prefix<view/>suffix')
    const element = parsed.children.find(node => node.kind === 'element') as ElementNode
    const document = { ...parsed, children: [element] }
    const next = renderEdits(session(document, element, { attributes: new Map([['edited', null]]) }))
    expect(next).toBe('prefix<view edited/>suffix')
  })

  it('propagates tracked ranges for untouched retained script owners', () => {
    const document = parse('<before/><wxs>value</wxs><after/>')
    const owner = document.children[1] as ElementNode
    const ranges = new Map([[owner, { start: 0, end: 0 }]])
    expect(renderEdits(session(document), ranges)).toBe(document.source)
    expect(ranges.get(owner)).toEqual({ start: owner.start, end: owner.end })
  })

  it('inserts beside raw text without replacing that text', () => {
    const next = edit(parse('original'), (handle) => {
      handle.insertBefore('<before/>')
      handle.insertAfter('<after/>')
    })
    expect(serialize(next)).toBe('<before/>original<after/>')
    expect(serialize(edit(parse('<!--old-->'), handle => handle.replaceWith('<!--new-->')))).toBe('<!--new-->')
  })

  it('falls back when consumer opening metadata does not describe a complete matching tag', () => {
    const original = parse('<view value="{{0}}"/><tail/>')
    const root = original.children[0] as ElementNode
    const changes = { attributes: new Map([['value', '{{1}}']]), unvalidatedAttributes: new Set(['value']) }
    const expanded: ElementNode = { ...root, selfClosing: false }
    expect(createPatchedDocument(session(original, expanded, changes))).toBeUndefined()
    const extended: ElementNode = { ...root, opening: { ...root.opening, end: original.source.length } }
    expect(createPatchedDocument(session(original, extended, changes))).toBeUndefined()
  })

  it('converts only lexical failures into invalid-edit errors', () => {
    const original = parse('<view/>')
    const root = original.children[0] as ElementNode
    const changes = { attributes: new Map([['value', '{{1}}']]), unvalidatedAttributes: new Set(['value']) }
    const malformed = { ...original, source: '<!bad/>' }
    expect(() => createPatchedDocument(session(malformed, root, changes))).toThrow('Invalid WXML document')
    const failure = new Error('consumer syntax getter failed')
    let reads = 0
    const hostile = { ...original, get syntax(): Document['syntax'] {
      if (reads++ > 0) {
        throw failure
      }
      return 'legacy'
    } }
    expect(() => createPatchedDocument(session(hostile, root, changes))).toThrow(failure)
  })

  it('rejects a raw owner disappearing without matching invalidation metadata', () => {
    const original = parse('<wxs></wxs>')
    const root = original.children[0] as ElementNode
    const state = session(original, root, { removed: true })
    state.rawOwners = new Map([[root, { isInvalidated: () => false }]])
    expect(() => parseRawEdits(state)).toThrow('original script owner')
  })

  it('classifies raw text as outside script element ownership', () => {
    const document = parse('ordinary text')
    const handle = new EditableHandle(session(document), document.children[0]!)
    const classifier = handle as unknown as { isRawElement: () => boolean }
    expect(classifier.isRawElement()).toBe(false)
  })
})
