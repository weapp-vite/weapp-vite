import * as t from '@weapp-vite/ast/babelTypes'
import { describe, expect, it } from 'vitest'
import { parse as babelParse } from '../../../utils/babel'
import { compileJsxAttributes, extractJsxKeyExpression } from './attributes'
import { createJsxCompileContext } from './template'

function parseOpeningElement(source: string) {
  const ast = babelParse(`const node = ${source}`, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  }) as any
  return ast.program.body[0].declarations[0].init.openingElement
}

describe('compileJsx attributes helpers', () => {
  it('extracts key expressions from string and dynamic values', () => {
    const stringKeyElement = parseOpeningElement('<view key="static" />')
    const dynamicKeyElement = parseOpeningElement('<view key={item.id} />')
    const missingKeyElement = parseOpeningElement('<view title="hello" />')
    const emptyKeyElement = t.jsxElement(
      t.jsxOpeningElement(
        t.jsxIdentifier('view'),
        [
          t.jsxAttribute(
            t.jsxIdentifier('key'),
            t.jsxExpressionContainer(t.jsxEmptyExpression()),
          ),
        ],
        true,
      ),
      null,
      [],
      true,
    )

    expect(extractJsxKeyExpression({ openingElement: stringKeyElement } as any)).toBe('static')
    expect(extractJsxKeyExpression({ openingElement: dynamicKeyElement } as any)).toBe('item.id')
    expect(extractJsxKeyExpression({ openingElement: missingKeyElement } as any)).toBeNull()
    expect(extractJsxKeyExpression(emptyKeyElement)).toBeNull()
    expect(extractJsxKeyExpression({
      openingElement: t.jsxOpeningElement(
        t.jsxIdentifier('view'),
        [
          t.jsxSpreadAttribute(t.identifier('rest')),
          t.jsxAttribute(t.jsxIdentifier('title'), t.stringLiteral('hello')),
        ],
        true,
      ),
    } as any)).toBeNull()
  })

  it('compiles normal attributes, className alias, booleans, and event handlers', () => {
    const context = createJsxCompileContext()
    context.scopeStack.push('item')
    const openingElement = parseOpeningElement(`
<view
  key={item.id}
  className="card"
  hidden={true}
  title={item.name}
  onTap={this.handleTap}
  onLongpress={() => tap(item)}
/>
    `)

    const attrs = compileJsxAttributes(openingElement.attributes, context)

    expect(attrs).toContain('class="card"')
    expect(attrs).toContain('hidden="{{true}}"')
    expect(attrs).toContain('title="{{item.name}}"')
    expect(attrs).toContain('bindtap="handleTap"')
    expect(attrs).toContain('bindlongpress="__weapp_vite_inline"')
    expect(attrs).toContain('data-wv-inline-id="__wv_inline_0"')
    expect(attrs).toContain('data-wv-s0="{{item}}"')
  })

  it('supports shorthand attrs, escaped string handlers, identifier handlers, and platform event prefixes', () => {
    const context = createJsxCompileContext()
    const openingElement = parseOpeningElement(`
<view
  disabled
  count={1}
  onTap={handleTap}
  catchTouchstart="stopTouch"
  captureBindTap={handleCapture}
  captureCatchTap={this.stopTap}
  mutBindTap={mutateTap}
/>
    `)

    const attrs = compileJsxAttributes(openingElement.attributes, context)

    expect(attrs).toContain('disabled="{{true}}"')
    expect(attrs).toContain('count="{{1}}"')
    expect(attrs).toContain('bindtap="handleTap"')
    expect(attrs).toContain('catchtouchstart="stopTouch"')
    expect(attrs).toContain('capture-bind:tap="handleCapture"')
    expect(attrs).toContain('capture-catch:tap="stopTap"')
    expect(attrs).toContain('mut-bind:tap="mutateTap"')
  })

  it('warns for spread and dynamic attribute names', () => {
    const context = createJsxCompileContext()
    const openingElement = t.jsxOpeningElement(
      t.jsxIdentifier('view'),
      [
        t.jsxSpreadAttribute(t.identifier('rest')),
        t.jsxAttribute(
          t.jsxNamespacedName(t.jsxIdentifier('ns'), t.jsxIdentifier('prop')),
          t.stringLiteral('value'),
        ),
      ],
      true,
    )

    const attrs = compileJsxAttributes(openingElement.attributes as any, context)

    expect(attrs).toEqual([])
    expect(context.warnings).toEqual([
      '暂不支持 JSX spread attributes，已忽略。',
      '暂不支持 JSX 动态属性名，已忽略。',
    ])
  })

  it('ignores empty expression containers for normal and event attributes', () => {
    const context = createJsxCompileContext()
    const openingElement = t.jsxOpeningElement(
      t.jsxIdentifier('view'),
      [
        t.jsxAttribute(
          t.jsxIdentifier('title'),
          t.jsxExpressionContainer(t.jsxEmptyExpression()),
        ),
        t.jsxAttribute(
          t.jsxIdentifier('onTap'),
          t.jsxExpressionContainer(t.jsxEmptyExpression()),
        ),
      ],
      true,
    )

    expect(compileJsxAttributes(openingElement.attributes as any, context)).toEqual([])
    expect(context.warnings).toEqual([])
  })

  it('skips unsupported jsx element attribute values and normalizes multi-word event names', () => {
    const context = createJsxCompileContext()
    const openingElement = t.jsxOpeningElement(
      t.jsxIdentifier('view'),
      [
        t.jsxAttribute(
          t.jsxIdentifier('title'),
          t.jsxElement(
            t.jsxOpeningElement(t.jsxIdentifier('text'), [], true),
            null,
            [],
            true,
          ),
        ),
        t.jsxAttribute(
          t.jsxIdentifier('onLongPress'),
          t.jsxExpressionContainer(t.identifier('handleLongPress')),
        ),
      ],
      true,
    )

    expect(compileJsxAttributes(openingElement.attributes as any, context)).toEqual([
      'bindlongpress="handleLongPress"',
    ])
  })
})
