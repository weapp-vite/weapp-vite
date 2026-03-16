import * as t from '@weapp-vite/ast/babelTypes'
import { describe, expect, it } from 'vitest'
import {
  resolveComponentExpression,
  resolveComponentOptionsObject,
  unwrapDefineComponent,
} from './scriptComponent'

describe('scriptComponent helpers', () => {
  it('unwraps defineComponent call with object argument', () => {
    const node = t.callExpression(
      t.identifier('defineComponent'),
      [t.objectExpression([t.objectProperty(t.identifier('a'), t.numericLiteral(1))])],
    )
    const result = unwrapDefineComponent(node, new Set(['defineComponent']))
    expect(result).toBeTruthy()
  })

  it('resolves component expression from identifiers and defineComponent aliases', () => {
    const defineComponentDecls = new Map<string, t.ObjectExpression>([
      ['opts', t.objectExpression([t.objectProperty(t.identifier('name'), t.stringLiteral('x'))])],
    ])
    const aliases = new Set(['defineComponent', 'dc'])

    const fromIdentifier = resolveComponentExpression(t.identifier('opts'), defineComponentDecls, aliases)
    expect(fromIdentifier).toBeTruthy()

    const fromCallWithIdentifier = resolveComponentExpression(
      t.callExpression(t.identifier('dc'), [t.identifier('opts')]),
      defineComponentDecls,
      aliases,
    )
    expect(fromCallWithIdentifier).toBeTruthy()

    const fromObjectAssign = resolveComponentExpression(
      t.callExpression(
        t.memberExpression(t.identifier('Object'), t.identifier('assign')),
        [t.objectExpression([]), t.objectExpression([t.objectProperty(t.identifier('x'), t.numericLiteral(1))])],
      ),
      defineComponentDecls,
      aliases,
    )
    expect(fromObjectAssign).toBeTruthy()
  })

  it('resolves options object from wrapped expressions and object assign calls', () => {
    const direct = resolveComponentOptionsObject(
      t.objectExpression([t.objectProperty(t.identifier('a'), t.numericLiteral(1))]),
    )
    expect(direct).toBeTruthy()

    const fromAssign = resolveComponentOptionsObject(
      t.callExpression(
        t.memberExpression(t.identifier('Object'), t.identifier('assign')),
        [
          t.identifier('base'),
          t.tsAsExpression(
            t.objectExpression([t.objectProperty(t.identifier('b'), t.numericLiteral(2))]),
            t.tsAnyKeyword(),
          ),
        ],
      ),
    )
    expect(fromAssign).toBeTruthy()
    expect((fromAssign!.properties[0] as t.ObjectProperty).key).toMatchObject({
      name: 'b',
    })
  })
})
