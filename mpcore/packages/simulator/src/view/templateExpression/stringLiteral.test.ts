import { parseExpression } from '@babel/parser'
import { describe, expect, it } from 'vitest'
import { resolveWxmlStringLiteral } from './stringLiteral'

function literal(source: string) {
  const node = parseExpression(source)
  if (node.type !== 'StringLiteral') {
    throw new Error('Expected a string literal.')
  }
  return node
}

describe('WXML AST string literals', () => {
  it.each([
    { source: String.raw`'a\'b'`, value: String.raw`a\x27b` },
    { source: String.raw`"a\"b"`, value: String.raw`a\x22b` },
    { source: String.raw`'tail\\'`, value: 'tail\\' },
    { source: String.raw`"tail\\"`, value: 'tail\\' },
    { source: String.raw`'a\\\'b'`, value: String.raw`a\\x27b` },
    { source: String.raw`"a\\\"b"`, value: String.raw`a\\x22b` },
  ])('matches observed native quote and slash semantics for $source', ({ source, value }) => {
    const node = literal(source)
    expect(resolveWxmlStringLiteral(node)).toBe(value)
    expect(resolveWxmlStringLiteral(node)).toBe(value)
  })

  it.each([
    { source: String.raw`'a\'b\n'`, value: 'a\'b\n' },
    { source: String.raw`"a\\\"b\t"`, value: 'a\\"b\t' },
    { source: String.raw`'path\\file\x21'`, value: String.raw`path\file!` },
    { source: String.raw`'a\u0027b'`, value: 'a\'b' },
    { source: String.raw`'a\"b'`, value: 'a"b' },
  ])('keeps the complete Babel result for unverified escapes in $source', ({ source, value }) => {
    const node = literal(source)
    expect(node.value).toBe(value)
    expect(resolveWxmlStringLiteral(node)).toBe(value)
  })

  it('preserves Babel values for synthetic nodes without a raw token', () => {
    expect(resolveWxmlStringLiteral({ value: 'a\'b' })).toBe('a\'b')
  })
})
