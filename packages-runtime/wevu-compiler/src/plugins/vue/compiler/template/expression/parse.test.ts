import { describe, expect, it } from 'vitest'
import {
  generateExpression,
  parseBabelExpression,
  parseBabelExpressionFile,
  parseInlineHandler,
} from './parse'
import { normalizeWxmlExpression } from './wxml'

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

  it('strips TypeScript-only syntax from template expressions', () => {
    expect(generateExpression(parseBabelExpression('(event: any) => handle(event)')!)).toBe('event=>handle(event)')
    expect(generateExpression(parseBabelExpression('column.$.exposed!.value as string')!)).toBe('column.$.exposed.value')
    expect(normalizeWxmlExpression('column.$.exposed!.sortDirection.value')).toBe('column.$.exposed.sortDirection.value')
  })

  it('rewrites Vue slot presence checks to mini-program slot metadata', () => {
    expect(normalizeWxmlExpression('!$slots.content && mode === \'normal\''))
      .toBe('!(vueSlots&&vueSlots.content)&&mode===\'normal\'')
    expect(normalizeWxmlExpression('$slots[\'preview-cover\'] || $slots.default'))
      .toBe('vueSlots&&vueSlots[\'preview-cover\']||vueSlots&&vueSlots.default')
    expect(normalizeWxmlExpression('$slots')).toBe('vueSlots')
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
