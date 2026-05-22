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
    expect(code).not.toContain('__wv_cls_0 = foo')
    expect(code).not.toContain('__wv_style_0 = bar')
  })

  it('keeps class/style fallback silent for first-paint missing values', () => {
    const bindings: any = [
      {
        name: '__wv_cls_0',
        type: 'class',
        exp: 'errors.email',
        expAst: t.objectExpression([
          t.objectProperty(
            t.stringLiteral('issue322-input-error'),
            t.memberExpression(t.identifier('errors'), t.identifier('email')),
          ),
        ]),
        errorFallback: 'issue322-input issue322-input-base',
        forStack: [],
      },
      {
        name: '__wv_style_0',
        type: 'style',
        exp: 'errors.email?"":"display: none"',
        expAst: t.conditionalExpression(
          t.memberExpression(t.identifier('errors'), t.identifier('email')),
          t.stringLiteral(''),
          t.stringLiteral('display: none'),
        ),
        errorFallback: 'display: none',
        forStack: [],
      },
    ]

    const code = buildClassStyleComputedCode(bindings, {
      normalizeClassName: 'normalizeClass',
      normalizeStyleName: 'normalizeStyle',
      unrefName: 'unref',
    })

    expect(code).not.toContain('console.error')
    expect(code).not.toContain('[wevu] 模板运行时表达式执行失败')
    expect(code).toContain('return"issue322-input issue322-input-base"')
    expect(code).toContain('return"display: none"')
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
    expect(code).toContain('this.data')
    expect(code).toContain('unref')
    expect(code).toContain('normalizeStyle')
  })

  it('uses runtime prop fallback helper for complex aliased class expressions', () => {
    const bindings: any = [
      {
        name: '__wv_cls_0',
        type: 'class',
        exp: 'root.a ? [foo, { [bar]: baz && items.length > 0 }] : nested.title + "-" + count',
        expAst: t.conditionalExpression(
          t.memberExpression(t.identifier('root'), t.identifier('a')),
          t.arrayExpression([
            t.identifier('foo'),
            t.objectExpression([
              t.objectProperty(
                t.identifier('bar'),
                t.logicalExpression(
                  '&&',
                  t.identifier('baz'),
                  t.binaryExpression(
                    '>',
                    t.memberExpression(t.identifier('items'), t.identifier('length')),
                    t.numericLiteral(0),
                  ),
                ),
                true,
              ),
            ]),
          ]),
          t.binaryExpression(
            '+',
            t.binaryExpression(
              '+',
              t.memberExpression(t.identifier('nested'), t.identifier('title')),
              t.stringLiteral('-'),
            ),
            t.identifier('count'),
          ),
        ),
        errorFallback: 'base',
        forStack: [],
      },
    ]

    const code = buildClassStyleComputedCode(bindings, {
      normalizeClassName: 'normalizeClass',
      normalizeStyleName: 'normalizeStyle',
      unrefName: 'unref',
    })

    expect(code).toContain('root.a')
    expect(code).toContain('root.a?[foo,{[bar]:baz&&items.length>0}]:nested.title+"-"+count')
    expect(code).toContain('return"base"')
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
