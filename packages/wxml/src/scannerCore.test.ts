import { describe, expect, it } from 'vitest'
import { createParser } from './core'
import { compileDialect, compiledState } from './dialect'
import { parse } from './parser'
import { scanCompiledDocument } from './scannerCore'

const dialect = compileDialect({ id: 'local-output', syntax: 'xml', rawTags: [] })
const state = compiledState(dialect)

describe('scanner-local complete document output', () => {
  it.each(['<view title="value">text<!--comment--><child/></view>', '<view>'])('owns independent output arrays for every scan: %s', (source) => {
    const first = scanCompiledDocument(source, state, undefined, true)
    const second = scanCompiledDocument(source, state, undefined, true)
    expect(second).toEqual(first)
    expect(second.tokens).not.toBe(first.tokens)
    expect(second.diagnostics).not.toBe(first.diagnostics)
    expect(second.children).not.toBe(first.children)
    const scanned = scanCompiledDocument(source, state, undefined, false)
    expect(scanned).toEqual({ tokens: first.tokens, diagnostics: first.diagnostics })
    expect(scanned.tokens).not.toBe(first.tokens)
    expect(scanned.diagnostics).not.toBe(first.diagnostics)
  })

  it('rejects invalid source before scanning', () => {
    expect(() => scanCompiledDocument(null as never, state, undefined, true)).toThrow('Expected template source.')
    expect(() => scanCompiledDocument(null as never, state, undefined, false)).toThrow('Expected template source.')
  })

  it('keeps public document fields owned and arrays independent across root and core parses', () => {
    const parser = createParser(dialect)
    const source = '<view>value</view>'
    for (const parseDocument of [() => parse(source), () => parser.parse(source)]) {
      const first = parseDocument()
      const second = parseDocument()
      expect(Object.getPrototypeOf(first)).toBe(Object.prototype)
      for (const field of ['source', 'syntax', 'tokens', 'diagnostics', 'children']) {
        expect(Object.hasOwn(first, field)).toBe(true)
      }
      expect(second.tokens).not.toBe(first.tokens)
      expect(second.diagnostics).not.toBe(first.diagnostics)
      expect(second.children).not.toBe(first.children)
      expect(second).toEqual(first)
    }
    const document = parse(source)
    expect(Object.hasOwn(document, 'platform')).toBe(true)
    expect(Object.hasOwn(document, 'options')).toBe(true)
    expect(parser.parse(source)).not.toHaveProperty('platform')
    expect(parser.parse(source)).not.toHaveProperty('options')
  })
})
