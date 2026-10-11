import { afterEach, describe, expect, it, vi } from 'vitest'
import * as babel from '../../../../../utils/babel'
import { normalizeJsExpressionWithContext } from './js'
import { generateExpression } from './parse'
import { normalizeWxmlExpression } from './wxml'

afterEach(() => vi.restoreAllMocks())

describe('context-independent WXML normalization', () => {
  it('reuses normalized syntax without sharing mutable rewrite nodes', () => {
    const parse = vi.spyOn(babel, 'parse')
    const source = 'normalizationCacheValue?.label ?? "empty"'
    const expected = normalizeWxmlExpression(source)
    expect(parse).toHaveBeenCalledTimes(1)
    expect(normalizeWxmlExpression(source)).toBe(expected)
    expect(parse).toHaveBeenCalledTimes(1)

    const context = {
      diagnostics: [],
      filename: 'src/cache.vue',
      rewriteScopedSlot: false,
      scopeStack: [],
      slotPropStack: [],
      forStack: [],
    } as any
    const rewritten = normalizeJsExpressionWithContext(source, context)
    expect(rewritten && generateExpression(rewritten)).toContain('this.normalizationCacheValue')
    expect(normalizeWxmlExpression(source)).toBe(expected)
    const local = normalizeJsExpressionWithContext(source, {
      ...context,
      scopeStack: [new Set(['normalizationCacheValue'])],
    })
    expect(local && generateExpression(local)).not.toContain('this.normalizationCacheValue')
  })

  it('retains fallback output for invalid syntax and exact source keys', () => {
    const parse = vi.spyOn(babel, 'parse')
    const invalid = 'cacheInvalid?.'
    expect(normalizeWxmlExpression(invalid)).toBe(invalid)
    expect(normalizeWxmlExpression(invalid)).toBe(invalid)
    expect(parse).toHaveBeenCalledTimes(1)
    expect(normalizeWxmlExpression(`${invalid} `)).toBe(`${invalid} `)
    expect(parse).toHaveBeenCalledTimes(2)
  })
})
