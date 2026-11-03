/* eslint-disable no-template-curly-in-string -- 测试覆盖嵌套模板字符串的原文。 */
import { describe, expect, it } from 'vitest'
import { expressionEnd, findScriptClosingTag, parse } from './index'

const expressions = [
  'function() {}',
  'function named() {}',
  'function*() { yield 1 }',
  'function* named() { yield 1 }',
  'async function() { await value }',
  'async function* named() { yield await value }',
  'function /* header */ * named /* parameters */ () /* body */ {}',
  'function(value = function() {} / 2) { return value }',
  'function(value = class {} / 2) { return value }',
  'function() { function inner() {} /ok/.test(value); return {} }',
  'function() { class Inner {} /ok/.test(value); return {} }',
  'class {}',
  'class Named {}',
  'class extends Base {}',
  'class extends factory() {}',
  'class extends function() {} {}',
  'class extends class {} {}',
  'class extends factory(class {}) {}',
  'class { method() { return function() {} / 2 } }',
  'class { field = function() {} / 2; static { function inner() {} /ok/.test(value) } }',
]

const declarations = [
  'function named() {}',
  'function* named() { yield 1 }',
  'async function named() { await value }',
  'async function* named() { yield await value }',
  'function /* header */ * named /* parameters */ () /* body */ {}',
  'function named(value = function() {} / 2) {}',
  'class Named {}',
  'class Named extends function() {} {}',
  'class Named extends class {} {}',
  'export function named() {}',
  'export async function named() {}',
  'export default function() {}',
  'export default async function() {}',
  'export default class {}',
  'if (ready) {}',
  'label: function named() {}',
  '{ function named() {} /ok/.test(value); }',
  'switch (value) { case ready ? 1 : 2: function named() {} /ok/.test(value); break; default: class Named {} }',
]

describe('construct body lexical ownership', () => {
  it.each(expressions)('restores a value after expression body: %s', (construct) => {
    for (const suffix of [' / 2', ' / /}}/.source.length']) {
      const expression = `{{ (${construct}${suffix}) }}`
      expect(expressionEnd(expression, 0)).toBe(expression.length)
      expect(parse(`<view>${expression}</view>`).diagnostics).toEqual([])
    }
    const source = `<wxs>var result = ${construct} / /<\\/wxs>/.source.length;</wxs><view/>`
    expect(findScriptClosingTag(source, 5, 'wxs')?.start).toBe(source.lastIndexOf('</wxs>'))
    expect(parse(source).diagnostics).toEqual([])
  })

  it.each(declarations)('preserves regex statements after declaration/block body: %s', (declaration) => {
    const source = `<wxs>${declaration} /<\\/wxs>/.test(value);</wxs><view/>`
    expect(findScriptClosingTag(source, 5, 'wxs')?.start).toBe(source.lastIndexOf('</wxs>'))
    expect(parse(source).diagnostics).toEqual([])
  })

  it.each([
    '{{ function() {} / 2 }}',
    '{{ async function*() {} / 2 }}',
    '{{ class {} / 2 }}',
    '{{ 2 > {} / /}}/.source.length }}',
    '{{ 2 >= {} / /}}/.source.length }}',
    '{{ ({ function: function() {} / 2, class: class {} / 2 }) }}',
    '{{ ({ function() { return /}}/ }, class() { return /}}/ } }) }}',
    '{{ ready ? function() {} / 2 : class {} / 2 }}',
    '{{ ready ?? function() {} / 2 }}',
    '{{ object?.function() / /}}/.source.length }}',
    '{{ (() => {}) / /}}/.source.length }}',
    '{{ `value ${function() {} / /}}/.source.length}` }}',
  ])('keeps expressions, arrows, operators and keyword-shaped properties separate: %s', (expression) => {
    expect(expressionEnd(expression, 0)).toBe(expression.length)
    expect(parse(`<view>${expression}</view>`).diagnostics).toEqual([])
  })

  it.each([
    'for (; function() {} / 2;) break;',
    'for (; class {} / 2;) break;',
    'switch (value) { case function() {} / 2: break; }',
    'switch (value) { case ready ? 1 : function() {} / 2: function named() {} /ok/.test(value); }',
    'var object = { function: 1, class: 2, method() { return function() {} / 2 } };',
  ])('tracks nested statement and value positions: %s', (body) => {
    const source = `<wxs>${body}</wxs><view/>`
    expect(findScriptClosingTag(source, 5, 'wxs')?.start).toBe(source.lastIndexOf('</wxs>'))
    expect(parse(source).diagnostics).toEqual([])
  })

  it.each(['\n', '\r\n', '\r', '\u2028', '\u2029', '/*\n*/', '/*\r*/', '// comment\n', '// comment\r', '// comment\u2028'])('restores declaration positions across ASI and comments: %j', (separator) => {
    for (const declaration of ['function named() {}', 'async function* named() {}', 'class Named {}']) {
      const source = `<wxs>var before = 1${separator}${declaration} /<\\/wxs>/.test(value);</wxs><view/>`
      expect(findScriptClosingTag(source, 5, 'wxs')?.start).toBe(source.lastIndexOf('</wxs>'))
      expect(parse(source).diagnostics).toEqual([])
    }
    const source = `<wxs>var value = function() {}${separator} / /<\\/wxs>/.source.length;</wxs><view/>`
    expect(findScriptClosingTag(source, 5, 'wxs')?.start).toBe(source.lastIndexOf('</wxs>'))
    expect(parse(source).diagnostics).toEqual([])
  })

  it.each([
    'function() { return\nfunction named() {} /ok/.test(value) }',
    'function\nnamed() {}',
    'class extends\nfunction() {} {}',
    'class extends /*\n*/ class {} {}',
  ])('preserves construct ownership while crossing line breaks: %s', (construct) => {
    const expression = `{{ (${construct} / /}}/.source.length) }}`
    expect(expressionEnd(expression, 0)).toBe(expression.length)
    const source = `<wxs>var value = ${construct} / /<\\/wxs>/.source.length;</wxs><view/>`
    expect(findScriptClosingTag(source, 5, 'wxs')?.start).toBe(source.lastIndexOf('</wxs>'))
    expect(parse(source).diagnostics).toEqual([])
  })

  it.each([
    'function<T extends {}>() { return 1 }',
    'function(): { value: number } { return { value: 1 } }',
    'function(): { left: number } & { right: number } { return value }',
    'function(): (() => { value: number }) { return value }',
    'function(): Promise<{ value: number }> { return value }',
    'class<T extends {}> {}',
    'class extends factory<{ value: number }>() {}',
  ])('keeps TypeScript header type braces outside the executable body: %s', (construct) => {
    const expression = `{{ (${construct} / 2) }}`
    expect(expressionEnd(expression, 0)).toBe(expression.length)
    const source = `<wxs lang="ts">var value = ${construct} / /<\\/wxs>/.source.length;</wxs><view/>`
    expect(findScriptClosingTag(source, source.indexOf('>') + 1, 'wxs')?.start).toBe(source.lastIndexOf('</wxs>'))
    expect(parse(source).diagnostics).toEqual([])
  })
})
