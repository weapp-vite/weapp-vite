import * as t from '@weapp-vite/ast/babelTypes'
import { describe, expect, it } from 'vitest'
import { compileRenderableExpression } from './render'
import { createJsxCompileContext } from './template'

describe('compileJsx render helpers', () => {
  it('renders array expressions while skipping null and boolean branches', () => {
    const context = createJsxCompileContext()
    const rendered = compileRenderableExpression(
      t.arrayExpression([
        t.stringLiteral('hello'),
        t.nullLiteral(),
        t.booleanLiteral(false),
        t.jsxElement(
          t.jsxOpeningElement(t.jsxIdentifier('view'), [], true),
          null,
          [],
          true,
        ),
      ]),
      context,
    )

    expect(rendered).toContain('{{"hello"}}')
    expect(rendered).toContain('<view />')
  })

  it('warns when map callback is invalid and falls back to interpolation', () => {
    const context = createJsxCompileContext()
    const rendered = compileRenderableExpression(
      t.callExpression(
        t.memberExpression(t.identifier('list'), t.identifier('map')),
        [t.identifier('renderItem')],
      ),
      context,
    )

    expect(rendered).toContain('{{list.map(renderItem)}}')
    expect(context.warnings).toContain('仅支持 map(fn) 形式的列表渲染。')
  })

  it('warns on jsx spread child and falls back member tags to view', () => {
    const context = createJsxCompileContext()
    const rendered = compileRenderableExpression(
      t.jsxFragment(
        t.jsxOpeningFragment(),
        t.jsxClosingFragment(),
        [
          t.jsxSpreadChild(t.identifier('rest')),
          t.jsxElement(
            t.jsxOpeningElement(
              t.jsxMemberExpression(t.jsxIdentifier('Foo'), t.jsxIdentifier('Bar')),
              [],
              true,
            ),
            null,
            [],
            true,
          ),
        ],
      ) as any,
      context,
    )

    expect(rendered).toContain('<view />')
    expect(context.warnings).toContain('暂不支持 JSX spread child，已忽略。')
    expect(context.warnings).toContain('暂不支持 JSX 成员标签（如 <Foo.Bar />），已回退为 <view />。')
  })

  it('renders logical-or fallback and list map blocks', () => {
    const context = createJsxCompileContext()
    const fallback = compileRenderableExpression(
      t.logicalExpression('||', t.identifier('ready'), t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('text'), [], false),
        t.jsxClosingElement(t.jsxIdentifier('text')),
        [t.jsxText('fallback')],
        false,
      )),
      context,
    )

    expect(fallback).toContain('wx:if="{{!(ready)}}"')
    expect(fallback).toContain('<text>fallback</text>')

    const list = compileRenderableExpression(
      t.callExpression(
        t.memberExpression(t.identifier('list'), t.identifier('map')),
        [
          t.arrowFunctionExpression(
            [t.identifier('item'), t.identifier('index')],
            t.jsxElement(
              t.jsxOpeningElement(
                t.jsxIdentifier('view'),
                [
                  t.jsxAttribute(
                    t.jsxIdentifier('key'),
                    t.jsxExpressionContainer(t.identifier('index')),
                  ),
                ],
                false,
              ),
              t.jsxClosingElement(t.jsxIdentifier('view')),
              [t.jsxExpressionContainer(t.identifier('item'))],
              false,
            ),
          ),
        ],
      ),
      context,
    )

    expect(list).toContain('wx:for="{{list}}"')
    expect(list).toContain('wx:key="index"')
    expect(list).toContain('{{item}}')
  })

  it('supports conditional, logical-and, and non-map call fallbacks', () => {
    const context = createJsxCompileContext()
    const conditional = compileRenderableExpression(
      t.conditionalExpression(
        t.identifier('ready'),
        t.jsxElement(
          t.jsxOpeningElement(t.jsxIdentifier('view'), [], true),
          null,
          [],
          true,
        ),
        t.booleanLiteral(false),
      ),
      context,
    )
    const logicalAnd = compileRenderableExpression(
      t.logicalExpression(
        '&&',
        t.identifier('visible'),
        t.jsxElement(
          t.jsxOpeningElement(t.jsxIdentifier('text'), [], false),
          t.jsxClosingElement(t.jsxIdentifier('text')),
          [t.jsxText('shown')],
          false,
        ),
      ),
      context,
    )
    const fallbackCall = compileRenderableExpression(
      t.callExpression(t.identifier('renderItem'), [t.identifier('item')]),
      context,
    )
    const fallbackLogical = compileRenderableExpression(
      t.logicalExpression('??' as any, t.identifier('value'), t.identifier('other')),
      context,
    )

    expect(conditional).toContain('wx:if="{{ready}}"')
    expect(conditional).toContain('<view />')
    expect(logicalAnd).toContain('wx:if="{{visible}}"')
    expect(logicalAnd).toContain('<text>shown</text>')
    expect(fallbackCall).toContain('{{renderItem(item)}}')
    expect(fallbackLogical).toContain('{{value!=null?value:other}}')
  })

  it('renders function-body maps, empty bodies, sparse arrays, and nested jsx text nodes', () => {
    const context = createJsxCompileContext()
    const mappedText = compileRenderableExpression(
      t.callExpression(
        t.memberExpression(t.identifier('list'), t.identifier('map')),
        [
          t.functionExpression(
            null,
            [t.identifier('item'), t.identifier('index')],
            t.blockStatement([
              t.returnStatement(t.identifier('item')),
            ]),
          ),
        ],
      ),
      context,
    )
    const emptyBody = compileRenderableExpression(
      t.callExpression(
        t.memberExpression(t.identifier('list'), t.identifier('map')),
        [
          t.arrowFunctionExpression(
            [t.identifier('item')],
            t.blockStatement([]),
          ),
        ],
      ),
      context,
    )
    const sparseArray = compileRenderableExpression(
      t.arrayExpression([
        null,
        t.spreadElement(t.identifier('rest')),
        t.stringLiteral('tail'),
      ]),
      context,
    )
    const nestedElement = compileRenderableExpression(
      t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('view'), [], false),
        t.jsxClosingElement(t.jsxIdentifier('view')),
        [
          t.jsxText('   '),
          t.jsxText('   hello   world   '),
          t.jsxExpressionContainer(t.jsxEmptyExpression()),
          t.jsxFragment(
            t.jsxOpeningFragment(),
            t.jsxClosingFragment(),
            [
              t.jsxText(' nested '),
            ],
          ),
        ],
        false,
      ),
      context,
    )

    expect(mappedText).toContain('wx:key="index"')
    expect(mappedText).toContain('{{item}}')
    expect(emptyBody).toBe('')
    expect(sparseArray).toContain('{{"tail"}}')
    expect(nestedElement).toBe('<view> hello world  nested </view>')
  })

  it('falls back to index keys for jsx maps without explicit keys and renders full conditional alternates', () => {
    const context = createJsxCompileContext()
    const list = compileRenderableExpression(
      t.callExpression(
        t.memberExpression(t.identifier('list'), t.identifier('map')),
        [
          t.arrowFunctionExpression(
            [t.identifier('item'), t.identifier('index')],
            t.jsxElement(
              t.jsxOpeningElement(t.jsxIdentifier('view'), [], false),
              t.jsxClosingElement(t.jsxIdentifier('view')),
              [t.jsxExpressionContainer(t.identifier('item'))],
              false,
            ),
          ),
        ],
      ),
      context,
    )
    const conditional = compileRenderableExpression(
      t.conditionalExpression(
        t.identifier('ready'),
        t.jsxElement(
          t.jsxOpeningElement(t.jsxIdentifier('text'), [], false),
          t.jsxClosingElement(t.jsxIdentifier('text')),
          [t.jsxText('yes')],
          false,
        ),
        t.jsxElement(
          t.jsxOpeningElement(t.jsxIdentifier('text'), [], false),
          t.jsxClosingElement(t.jsxIdentifier('text')),
          [t.jsxText('no')],
          false,
        ),
      ),
      context,
    )

    expect(list).toContain('wx:key="index"')
    expect(conditional).toContain('wx:if="{{ready}}"')
    expect(conditional).toContain('wx:else')
    expect(conditional).toContain('<text>no</text>')
  })
})
