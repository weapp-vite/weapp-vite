/* eslint-disable no-template-curly-in-string -- 测试覆盖模板插值及脚本模板字符串的原文。 */
import { describe, expect, it } from 'vitest'
import { expressionEnd, findScriptClosingTag, parse } from './index'

describe('shared JavaScript token context', () => {
  it.each(['in', 'typeof', 'void', 'delete', 'instanceof', 'new', 'return', 'throw', 'yield', 'await', 'else', 'do'])('treats member %s as a value before division', (word) => {
    for (const member of [`object.${word}`, `object . /* between */ ${word}`, `object?.${word}`, `object?. /* between */ ${word}`, `object.\r\n${word}`]) {
      const expression = `{{ ${member} / 2 }}`
      expect(expressionEnd(expression, 0), member).toBe(expression.length)
      const source = `<wxs>var value = ${member} / 2;</wxs><view/>`
      expect(findScriptClosingTag(source, 5, 'wxs')?.start, member).toBe(source.indexOf('</wxs>'))
      expect(parse(source).diagnostics, member).toEqual([])
    }
  })

  it.each(['if', 'while', 'for', 'with', 'switch', 'catch'])('treats control-keyword method %s as a call before division', (word) => {
    for (const member of [`object.${word}`, `object . /* between */ ${word}`, `object?.${word}`, `object["${word}"]`]) {
      const expression = `{{ ${member}(value) / /}}/.source.length }}`
      expect(expressionEnd(expression, 0), member).toBe(expression.length)
      const source = `<wxs>var value = ${member}(value) / /<\\/wxs>/.source.length;</wxs><view/>`
      expect(findScriptClosingTag(source, 5, 'wxs')?.start, member).toBe(source.lastIndexOf('</wxs>'))
      expect(parse(source).diagnostics, member).toEqual([])
    }
  })

  it.each([
    'if (ready) /}}/.test(value);',
    'while (ready) /}}/.test(value);',
    'for (; ready;) /}}/.test(value);',
    'with (value) /}}/.test(value);',
    'switch (value) { case 1: /}}/.test(value); }',
    'try {} catch (error) { /}}/.test(error); }',
    'if /* before */ (ready) /* after */ /}}/.test(value);',
  ])('accepts regex after control parentheses inside an expression body: %s', (body) => {
    const expression = `{{ (() => { ${body} return true })() }}`
    expect(expressionEnd(expression, 0)).toBe(expression.length)
    expect(parse(`<view>${expression}</view>`).diagnostics).toEqual([])
    const script = body.replaceAll('}}', '<\\/wxs>')
    const source = `<wxs>${script}</wxs><view/>`
    expect(findScriptClosingTag(source, 5, 'wxs')?.start).toBe(source.lastIndexOf('</wxs>'))
  })

  it.each([
    '{{ typeof /}}/ }}',
    '{{ "key" in /}}/ }}',
    '{{ value instanceof /}}/.constructor }}',
    '{{ object.in / /}}/.source.length }}',
    '{{ ({ value: 4 }).value / 2 }}',
    '{{ { value: 4 } / 2 }}',
    '{{ value++ / /}}/.source.length }}',
    '{{ ++value / 2 }}',
    '{{ `value ${object.in / 2}` }}',
    '{{ `value ${(() => { if (ready) /}}/.test(value); return 1 })()}` }}',
  ])('preserves actual operators, object literals and nested template contexts: %s', (expression) => {
    expect(expressionEnd(expression, 0)).toBe(expression.length)
    expect(parse(`<view>${expression}</view>`).diagnostics).toEqual([])
  })
})
