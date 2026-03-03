import { describe, expect, it } from 'vitest'
import {
  generateExpression,
  parseBabelExpression,
  parseBabelExpressionFile,
  parseInlineHandler,
} from './parse'

describe('template expression parse helpers', () => {
  it('parses expression and reuses cache for same source', () => {
    const first = parseBabelExpression('foo + bar')
    const second = parseBabelExpression('foo + bar')

    expect(first).toBeTruthy()
    expect(second).toBe(first)
    expect(generateExpression(first!)).toContain('foo+bar')
  })

  it('returns null for invalid expression', () => {
    expect(parseBabelExpression('foo +')).toBeNull()
    // hit cached false sentinel branch
    expect(parseBabelExpression('foo +')).toBeNull()
  })

  it('parses expression file helper and returns null when invalid', () => {
    const parsed = parseBabelExpressionFile('foo?.bar')
    expect(parsed).toBeTruthy()
    expect(parsed?.ast.program.body.length).toBe(1)
    expect(parsed?.expression.type).toBeTruthy()

    expect(parseBabelExpressionFile('const =')).toBeNull()
  })

  it('parses inline handler call args and unwraps ts wrapper nodes', () => {
    const handler = parseInlineHandler(
      `submit($event, 'x', 1, true, null, foo as any, bar!, baz + 1)`,
    )

    expect(handler).toBeTruthy()
    expect(handler?.name).toBe('submit')
    expect(handler?.args[0]).toEqual({ type: 'event', expression: '\'$event\'' })
    expect(handler?.args[1]).toEqual({ type: 'literal', value: 'x', expression: '\'x\'' })
    expect(handler?.args[2]).toEqual({ type: 'literal', value: 1, expression: '1' })
    expect(handler?.args[3]).toEqual({ type: 'literal', value: true, expression: 'true' })
    expect(handler?.args[4]).toEqual({ type: 'literal', value: null, expression: 'null' })
    expect(handler?.args[5]).toEqual({ type: 'expression', expression: 'foo' })
    expect(handler?.args[6]).toEqual({ type: 'expression', expression: 'bar' })
    expect(handler?.args[7]).toEqual({ type: 'expression', expression: 'baz+1' })
  })

  it('returns null for unsupported inline handler forms', () => {
    expect(parseInlineHandler('obj.submit()')).toBeNull()
    expect(parseInlineHandler('justValue')).toBeNull()
    expect(parseInlineHandler('submit(...args)')).toBeNull()
    // hit cached false sentinel branch
    expect(parseInlineHandler('submit(...args)')).toBeNull()
  })
})
