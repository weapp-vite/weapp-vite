/* eslint-disable no-template-curly-in-string -- 测试覆盖嵌套模板字符串不确定的恢复边界。 */
import type { Syntax } from './types'
import { describe, expect, it } from 'vitest'
import { edit, expressionEnd, parse, readTag, scan, serialize, TemplateLexicalError } from './index'

function lexicalError(run: () => unknown) {
  try {
    run()
  }
  catch (error) {
    expect(error).toBeInstanceOf(TemplateLexicalError)
    return error as TemplateLexicalError
  }
  throw new Error('Expected a template lexical error.')
}

describe('deterministic interpolation recovery range', () => {
  it.each([
    '{{ (value] }}',
    '{{ items[0 }}',
    '{{ value) }}',
    '{{ ((value }}',
    '{{ "}}" + /}}/.test(value) + (value] }}',
    '{{ { value: (value] } }}',
  ])('reports the complete known mustache range without accepting %s', (binding) => {
    const error = lexicalError(() => expressionEnd(binding, 0))
    expect(error.recovery).toEqual({ kind: 'interpolation', start: 0, end: binding.length })
    const source = `😀<view>${binding}</view><text>tail</text>`
    const result = scan(source)
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'template/invalid-interpolation',
      severity: 'error',
      recovery: { kind: 'interpolation', start: source.indexOf(binding), end: source.indexOf(binding) + binding.length },
    }))
    const document = parse(source)
    expect(() => edit(document, () => {})).toThrow(TypeError)
    expect(() => serialize(document, { mode: 'preserve' })).toThrow(TypeError)
    expect(() => serialize(document, { mode: 'canonical' })).toThrow(TypeError)
  })

  it.each([
    ['xml', '{{ &quot;}}&quot; + (value] }}'],
    ['legacy', String.raw`{{ \"}}\" + (value] }}`],
    ['legacy', String.raw`{{ \"😀a\\\"}}b\" + (value] }}`],
  ] as const)('preserves UTF-16 offsets through %s attribute encoding and direct tag reads', (syntax: Syntax, binding) => {
    const source = `😀<view title="${binding}"/><text>tail</text>`
    const recovery = { kind: 'interpolation', start: source.indexOf(binding), end: source.indexOf(binding) + binding.length }
    expect(lexicalError(() => readTag(source, source.indexOf('<view'), syntax)).recovery).toEqual(recovery)
    const diagnostic = parse(source, { syntax }).diagnostics[0]!
    expect(diagnostic.code).toBe('template/invalid-interpolation')
    expect(diagnostic.recovery).toEqual(recovery)
    expect(source.slice(diagnostic.recovery!.start, diagnostic.recovery!.end)).toBe(binding)
  })

  it.each([
    '{{ (value] ',
    '{{ (value] + "unterminated }}',
    '{{ (value] /* unterminated }}',
    '{{ /unterminated }}',
    '{{ { value: 1 }}',
    '{{ `value ${(value]}` }}',
  ])('does not invent a recovery range for an uncertain boundary: %s', (binding) => {
    expect(lexicalError(() => expressionEnd(binding, 0)).recovery).toBeUndefined()
    const diagnostic = scan(`<view>${binding}</view>`).diagnostics[0]!
    expect(diagnostic.code).toBe('template/invalid-syntax')
    expect(diagnostic.recovery).toBeUndefined()
  })

  it.each([
    '<view title="unterminated }}>',
    '<wxs>var value = "unterminated }};</wxs>',
    '<view><text></view>',
    '<!-- unterminated }}',
  ])('keeps quote, script, tag and comment errors outside interpolation recovery: %s', (source) => {
    const result = scan(source)
    expect(result.diagnostics.length).toBeGreaterThan(0)
    expect(result.diagnostics.every(diagnostic => diagnostic.recovery === undefined)).toBe(true)
  })
})
