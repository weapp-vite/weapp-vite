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

  it('keeps scoped slot owner method calls on the runtime owner proxy', () => {
    const bindings: any = [
      {
        name: '__wv_bind_0',
        type: 'bind',
        exp: '__wevuUnref((this.__wvOwnerProxy || this.__wvOwner).func)(__wevuUnref((this.__wvOwnerProxy || this.__wvOwner).text))',
        expAst: t.callExpression(
          t.callExpression(t.identifier('__wevuUnref'), [
            t.memberExpression(
              t.logicalExpression(
                '||',
                t.memberExpression(t.thisExpression(), t.identifier('__wvOwnerProxy')),
                t.memberExpression(t.thisExpression(), t.identifier('__wvOwner')),
              ),
              t.identifier('func'),
            ),
          ]),
          [
            t.callExpression(t.identifier('__wevuUnref'), [
              t.memberExpression(
                t.logicalExpression(
                  '||',
                  t.memberExpression(t.thisExpression(), t.identifier('__wvOwnerProxy')),
                  t.memberExpression(t.thisExpression(), t.identifier('__wvOwner')),
                ),
                t.identifier('text'),
              ),
            ]),
          ],
        ),
        forStack: [],
      },
    ]

    const entries = buildClassStyleComputedEntries(bindings, {
      normalizeClass: t.identifier('normalizeClass'),
      normalizeStyle: t.identifier('normalizeStyle'),
      unref: t.identifier('__wevuUnref'),
    })
    const code = buildClassStyleComputedCode(bindings, {
      normalizeClassName: 'normalizeClass',
      normalizeStyleName: 'normalizeStyle',
      unrefName: '__wevuUnref',
    })
    const binding = entries[0]?.value as t.FunctionExpression | undefined

    expect(code).toContain('__wvOwnerProxy')
    expect(code).toContain('__wvOwner')
    expect(code).toContain('.func)')
    expect(code).toContain('.text)')
    expect(binding).toBeDefined()
    expect(binding!.body.body).toMatchObject([
      {
        type: 'ReturnStatement',
        argument: {
          callee: {
            type: 'ArrowFunctionExpression',
          },
        },
      },
    ])
  })
})
