import { describe, expect, it } from 'vitest'
import {
  generateExpression,
  parseBabelExpression,
  parseBabelExpressionFile,
  parseInlineHandler,
} from './parse'
import { normalizeWxmlExpression } from './wxml'

const MDN_NUMERIC_LITERAL_CASES = [
  ['1234567890', '1234567890'],
  ['42', '42'],
  ['0b10000000000000000000000000000000', '2147483648'],
  ['0b01111111100000000000000000000000', '2139095040'],
  ['0B00000000011111111111111111111111', '8388607'],
  ['0O755', '493'],
  ['0o644', '420'],
  ['0xFFFFFFFFFFFFFFFFF', '295147905179352830000'],
  ['0x123456789ABCDEF', '81985529216486900'],
  ['0XA', '10'],
  ['1_000_000_000_000', '1000000000000'],
  ['1_050.95', '1050.95'],
  ['0b1010_0001_1000_0101', '41349'],
  ['0o2_2_5_6', '1198'],
  ['0xA0_B0_C0', '10531008'],
  ['1_000_000_000_000_000_000_000n', `'1000000000000000000000'`],
] as const

const MDN_INVALID_NUMERIC_SEPARATOR_CASES = [
  '100__000',
  '100_',
  '0_1',
] as const

const BIGINT_WXML_BOUNDARY_CASES = [
  ['42n', '42'],
  ['-42n', '-42'],
  ['9007199254740991n', '9007199254740991'],
  ['9007199254740992n', `'9007199254740992'`],
  ['-9007199254740992n', `'-9007199254740992'`],
] as const

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

  it('removes Vue-style this prefixes from WXML expressions', () => {
    expect(normalizeWxmlExpression('this.count')).toBe('count')
    expect(normalizeWxmlExpression('this.list.map(item => item.value)')).toBe('list.map(item=>item.value)')
  })

  it.each(MDN_NUMERIC_LITERAL_CASES)('normalizes the MDN numeric literal %s for WXML', (source, expected) => {
    expect(normalizeWxmlExpression(source)).toBe(expected)
  })

  it.each(MDN_INVALID_NUMERIC_SEPARATOR_CASES)('keeps the invalid MDN numeric separator case %s rejected', (source) => {
    expect(parseBabelExpression(source)).toBeNull()
    expect(normalizeWxmlExpression(source)).toBe(source)
  })

  it.each(BIGINT_WXML_BOUNDARY_CASES)('serializes the BigInt boundary case %s without precision loss', (source, expected) => {
    expect(normalizeWxmlExpression(source)).toBe(expected)
  })

  it('does not rewrite numeric-looking string contents', () => {
    expect(normalizeWxmlExpression(`label === '1_000_000'`))
      .toBe(`label==='1_000_000'`)
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
