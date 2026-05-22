import * as t from '@weapp-vite/ast/babelTypes'
import { describe, expect, it } from 'vitest'
import {
  buildClassStyleComputedCode,
  buildClassStyleComputedEntries,
  buildClassStyleComputedObject,
} from './classStyleComputed'

describe('classStyleComputed', () => {
  it('returns null when no class/style bindings are provided', () => {
    expect(buildClassStyleComputedObject([], {
      normalizeClass: t.identifier('cls'),
      normalizeStyle: t.identifier('style'),
    })).toBeNull()
    expect(buildClassStyleComputedCode([], {
      normalizeClassName: 'cls',
      normalizeStyleName: 'style',
    })).toBeNull()
  })

  it('builds computed entries for class/style/bind types', () => {
    const bindings: any = [
      {
        name: '__wv_cls_0',
        type: 'class',
        exp: 'foo',
        expAst: t.identifier('foo'),
        errorFallback: 'base',
        forStack: [],
      },
      {
        name: '__wv_style_0',
        type: 'style',
        exp: 'bar',
        expAst: t.identifier('bar'),
        errorFallback: 'display: none',
        forStack: [],
      },
      {
        name: '__wv_bind_0',
        type: 'bind',
        exp: 'getValue()',
        expAst: t.callExpression(t.identifier('getValue'), []),
        forStack: [],
      },
    ]

    const entries = buildClassStyleComputedEntries(bindings, {
      normalizeClass: t.identifier('normalizeClass'),
      normalizeStyle: t.identifier('normalizeStyle'),
      unref: t.identifier('unref'),
    })

    expect(entries).toHaveLength(3)
    const code = buildClassStyleComputedCode(bindings, {
      normalizeClassName: 'normalizeClass',
      normalizeStyleName: 'normalizeStyle',
      unrefName: 'unref',
    })
    expect(code).toContain('__wv_cls_0')
    expect(code).toContain('normalizeClass')
    expect(code).toContain('normalizeStyle')
    expect(code).toContain('__wv_bind_0')
    expect(code).toContain('return"base"')
    expect(code).toContain('return"display: none"')
    expect(code).toContain('console.error')
    expect(code).toContain('[wevu]')
    expect(code).toContain('__wv_bind_0 = getValue()')
  })

  it('keeps data props fallback through computed class/style expressions', () => {
    const bindings: any = [
      {
        name: '__wv_style_0',
        type: 'style',
        exp: 'data.color + data.size',
        expAst: t.binaryExpression(
          '+',
          t.memberExpression(t.identifier('data'), t.identifier('color')),
          t.memberExpression(t.identifier('data'), t.identifier('size')),
        ),
        errorFallback: '',
        forStack: [],
      },
    ]

    const code = buildClassStyleComputedCode(bindings, {
      normalizeClassName: 'normalizeClass',
      normalizeStyleName: 'normalizeStyle',
      unrefName: 'unref',
    })

    expect(code).toContain('this.__wevuProps.data')
    expect(code).toContain('Object.prototype.hasOwnProperty.call(this.__wevuProps,"data")')
    expect(code).toContain('this.data')
    expect(code).toContain('unref')
    expect(code).toContain('normalizeStyle')
  })

  it('builds nested for expressions for array/object lists', () => {
    const bindings: any = [
      {
        name: '__wv_cls_nested',
        type: 'class',
        exp: 'item.cls',
        expAst: t.memberExpression(t.identifier('item'), t.identifier('cls')),
        forStack: [
          {
            listExp: 'list',
            listExpAst: t.identifier('list'),
            item: 'item',
            index: 'index',
          },
          {
            listExp: 'mapLike',
            listExpAst: t.identifier('mapLike'),
            item: 'entry',
            index: 'key',
            key: 'actualKey',
          },
        ],
      },
    ]

    const code = buildClassStyleComputedCode(bindings, {
      normalizeClassName: 'normalizeClass',
      normalizeStyleName: 'normalizeStyle',
      unrefName: 'unref',
    })
    expect(code).toContain('Array.isArray')
    expect(code).toContain('Object.keys')
    expect(code).toContain('actualKey')
  })
})
