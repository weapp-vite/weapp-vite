import * as t from '@weapp-vite/ast/babelTypes'
import { describe, expect, it } from 'vitest'
import { generate } from '../../../../../utils/babel'
import { injectInlineExpressions } from './inlineExpressions'

describe('injectInlineExpressions', () => {
  it('returns false when inline expression list is empty', () => {
    expect(injectInlineExpressions(t.objectExpression([]), [])).toBe(false)
  })

  it('injects methods + inline map when methods property is missing', () => {
    const optionsObject = t.objectExpression([])
    const changed = injectInlineExpressions(optionsObject, [
      {
        id: 'e0',
        expression: 'foo + 1',
        scopeKeys: ['foo'],
      },
    ])

    expect(changed).toBe(true)
    const code = generate(optionsObject).code
    expect(code).toContain('methods')
    expect(code).toContain('__weapp_vite_inline_map')
    expect(code).toContain('"e0"')
  })

  it('returns false when methods is not an object expression', () => {
    const optionsObject = t.objectExpression([
      t.objectProperty(t.identifier('methods'), t.identifier('sharedMethods')),
    ])

    expect(injectInlineExpressions(optionsObject, [
      {
        id: 'e1',
        expression: 'bar',
        scopeKeys: ['bar'],
      },
    ])).toBe(false)
  })

  it('merges inline map into methods resolved from spread sources', () => {
    const optionsObject = t.objectExpression([
      t.spreadElement(t.identifier('__default__')),
      t.objectProperty(
        t.identifier('setup'),
        t.arrowFunctionExpression([], t.objectExpression([])),
      ),
    ])

    expect(injectInlineExpressions(optionsObject, [
      {
        id: 'e_spread',
        expression: 'onChange($event)',
        scopeKeys: [],
      },
    ])).toBe(true)

    const code = generate(optionsObject).code
    expect(code).toContain('methods: Object.assign({}, __default__?.methods || {}')
    expect(code).toContain('__weapp_vite_inline_map')
  })

  it('appends map entry when inline map already exists', () => {
    const optionsObject = t.objectExpression([
      t.objectProperty(
        t.identifier('methods'),
        t.objectExpression([
          t.objectProperty(
            t.identifier('__weapp_vite_inline_map'),
            t.objectExpression([
              t.objectProperty(
                t.stringLiteral('old'),
                t.objectExpression([]),
              ),
            ]),
          ),
        ]),
      ),
    ])

    expect(injectInlineExpressions(optionsObject, [
      {
        id: 'e2',
        expression: 'baz',
        scopeKeys: ['baz'],
      },
    ])).toBe(true)

    const code = generate(optionsObject).code
    expect(code).toContain('"old"')
    expect(code).toContain('"e2"')
  })

  it('returns false when existing inline map is not an object', () => {
    const optionsObject = t.objectExpression([
      t.objectProperty(
        t.identifier('methods'),
        t.objectExpression([
          t.objectProperty(
            t.identifier('__weapp_vite_inline_map'),
            t.stringLiteral('bad'),
          ),
        ]),
      ),
    ])

    expect(injectInlineExpressions(optionsObject, [
      {
        id: 'e3',
        expression: 'qux',
        scopeKeys: ['qux'],
      },
    ])).toBe(false)
  })

  it('serializes index bindings and scope resolvers, including parse fallbacks', () => {
    const optionsObject = t.objectExpression([])
    expect(injectInlineExpressions(optionsObject, [
      {
        id: 'e4',
        expression: '(',
        scopeKeys: ['a', 'b'],
        indexBindings: [
          { key: 'i', binding: 'index' },
        ],
        scopeResolvers: [
          { key: 'a', expression: 'scope.a' },
          { key: 'b', expression: '(' },
        ],
      },
    ])).toBe(true)

    const code = generate(optionsObject).code
    expect(code).toContain('indexKeys')
    expect(code).toContain('scopeResolvers')
    expect(code).toContain('undefined')
  })
})
