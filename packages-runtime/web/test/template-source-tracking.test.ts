import type { TemplateScopeSource } from '../src/runtime/templateScopeSources'
import { describe, expect, it } from 'vitest'
import { buildTemplateDataSources } from '../src/compiler/wxml/templateDataSources'
import { readControlledValue } from '../src/runtime/controlledAttributes/dependencies'
import { evaluateExpression } from '../src/runtime/renderContext'
import { registerTemplateScopeSources, resolveTemplateScopeSource } from '../src/runtime/templateScopeSources'

function compileSources(raw: string): TemplateScopeSource[] {
  // eslint-disable-next-line no-new-func -- 执行编译器生成的参数读取器，验证来源与实际求值一致。
  return new Function('ctx', 'wxs', `return ${buildTemplateDataSources(raw, 'wxs')}`)({ eval: evaluateExpression }, {})
}

describe('template data source tracking', () => {
  it('tracks absent spread keys so a later explicit override replaces the earlier field source', () => {
    const parent = { base: 1, overrides: {} as Record<string, number> }
    const scope = { value: 1 }
    registerTemplateScopeSources(scope, parent, compileSources('{{ {value: base, ...overrides} }}'))
    const source = resolveTemplateScopeSource(scope, 'value')!
    expect(source.read(parent)).toBe(1)
    parent.overrides.value = 2
    expect(source.read(parent)).toBe(2)
  })
  it.each([
    ['{{ left && {value: right} }}', { left: true, right: 4 }, 'value', 4],
    ['{{ left && {value: right} }}', { left: false, right: 4 }, 'value', undefined],
    ['{{ left || {value: right} }}', { left: null, right: 4 }, 'value', 4],
    ['{{ left || {value: right} }}', { left: { value: 3 }, right: 4 }, 'value', 3],
    ['{{ left ?? {value: right} }}', { left: null, right: 4 }, 'value', 4],
    ['{{ left ?? {value: right} }}', { left: { value: 3 }, right: 4 }, 'value', 3],
    ['{{ [left, {value: right}] }}', { left: 2, right: 4 }, '0', 2],
    ['{{ [, ...left] }}', { left: [2, 3] }, '1', 2],
    ['{{ { [key]: right, "fixed": left } }}', { key: 'value', left: 2, right: 4 }, 'value', 4],
    ['{{ { ...{}, value: right } }}', { right: 4 }, 'value', 4],
    ['{{ { get value() { return 4 } } }}', {}, 'value', 4],
    ['plain', {}, 'missing', undefined],
  ])('resolves %s through generated readers', (raw, parent, key, expected) => {
    const scope = { [key]: expected }
    registerTemplateScopeSources(scope, parent, compileSources(raw))
    expect(resolveTemplateScopeSource(scope, key)?.read(parent)).toEqual(expected)
  })

  it('defers malformed expression errors to the normal runtime evaluator', () => {
    const scope = { missing: undefined }
    registerTemplateScopeSources(scope, {}, compileSources('{{ broken( }}'))
    expect(() => resolveTemplateScopeSource(scope, 'missing')!.read({})).toThrow('无法解析表达式')
  })

  it('preserves inherited scopes, computed keys and untracked properties of constructed objects', () => {
    const marker = Symbol('identity')
    const parent = { key: 'box', value: 4 }
    const actual = { value: 1, extra: 2, [marker]: 3 }
    const owner = { box: actual }
    registerTemplateScopeSources(owner, parent, [{ key: scope => scope.key, read: () => actual, object: [{ key: 'value', read: scope => scope.value }] }])
    const inherited = Object.create(owner)
    const box = resolveTemplateScopeSource(inherited, 'box')!.read(parent) as typeof actual
    expect(box.value).toBe(4)
    expect(box.extra).toBe(2)
    expect(box[marker]).toBe(3)
    expect(resolveTemplateScopeSource(inherited, 'missing')).toBeUndefined()
    expect(resolveTemplateScopeSource(Object.create(null), 'missing')).toBeUndefined()
    expect(resolveTemplateScopeSource({ standalone: true }, 'standalone')).toBeUndefined()
  })

  it.each([
    [[3, 4], 1, 4],
    [{ first: 3, second: 4 }, 1, 4],
    [{ first: 3 }, 2, undefined],
    [null, 2, 2],
  ])('resolves primitive loop items from %j at index %i', (values, index, expected) => {
    const parent = { values }
    const scope = { item: expected, unrelated: 9 }
    registerTemplateScopeSources(scope, parent, [{ key: 'item', index, read: value => value.values }])
    expect(resolveTemplateScopeSource(scope, 'item')!.read(parent)).toBe(expected)
    expect(resolveTemplateScopeSource(scope, 'unrelated')!.read(parent)).toBe(9)
    registerTemplateScopeSources(scope, parent)
    expect(resolveTemplateScopeSource(scope, 'item')!.read(parent)).toBe(expected)
  })

  it('tracks aliased objects, cycles, special values and nested dependency replacement', () => {
    const marker = Symbol('opaque')
    const shared = { field: 3, [marker]: 4 }
    const root: Record<string | symbol, any> = { first: shared, second: shared, date: new Date(0), plain: Object.create(null), [marker]: 5 }
    root.self = root
    const scope = { alias: shared, foreign: { value: 6 }, missing: false, date: root.date, plain: root.plain, [marker]: 7 }
    const read = readControlledValue((tracked) => {
      expect(tracked[marker as any]).toBe(7)
      const alias = tracked.alias as typeof shared
      expect(alias[marker]).toBe(4)
      expect(alias.field).toBe(3)
      expect(tracked.date).toBe(root.date)
      expect(tracked.foreign).toEqual({ value: 6 })
      expect(tracked.missing).toBe(false)
      expect(tracked.plain).toEqual({})
      return tracked.alias
    }, scope, root)
    expect(read.value).toBe(shared)
    expect(read.paths).toEqual(expect.arrayContaining([['first', 'field'], ['second', 'field'], ['date'], ['plain']]))
    expect(read.paths).not.toContainEqual(['first'])
    expect(read.paths).not.toContainEqual(['foreign'])
    expect(readControlledValue(tracked => tracked.date, scope, root).value).toBe(root.date)
  })

  it('reads a primitive replacement for a previously constructed template object', () => {
    const scope = { box: 0 }
    registerTemplateScopeSources(scope, {}, [{ key: 'box', read: () => 2, object: [{ key: 'field', read: () => 3 }] }])
    expect(resolveTemplateScopeSource(scope, 'box')!.read({})).toBe(2)
  })

  it('resolves chained source metadata through the same cached tracked parent', () => {
    const parent = { left: 1, right: 2 }
    const scope = { a: 0, b: 0 }
    registerTemplateScopeSources(scope, parent, [
      { key: 'a', read: tracked => tracked.left },
      { key: 'b', read: tracked => tracked.right },
    ])
    expect(readControlledValue(tracked => Number(tracked.a) + Number(tracked.b), scope, parent))
      .toEqual({ value: 3, paths: [['left'], ['right']] })
  })
})
