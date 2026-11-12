import * as t from '@weapp-vite/ast/babelTypes'
import { describe, expect, it } from 'vitest'
import { getMiniProgramTemplatePlatform } from '../../vue/compiler/template/platforms'
import { compileRenderableExpression, renderDynamicIslandSupportTemplate } from './render'
import { createJsxCompileContext } from './template'

describe('compileJsx render helpers', () => {
  const defaultPlatform = getMiniProgramTemplatePlatform()

  it('emits one event handler dataset per dynamic island host node', () => {
    const template = renderDynamicIslandSupportTemplate(createJsxCompileContext())
    const input = template.match(/<input\b[^>]+\/>/)?.[0]

    expect(input).toBeTruthy()
    expect(input?.match(/data-wv-jsx-handler=/g)).toHaveLength(1)
    expect(input).toContain('node.events.input||node.events.change')
    expect(template).toContain('node.events.tap')
    expect(template).toContain('template name="__wv_jsx_node"')
    expect(template).toContain('template is="__wv_jsx_node_1"')
    expect(template).not.toContain('template is="__wv_jsx_node"')
  })

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
        ),
      ]),
      context,
    )

    expect(rendered).toContain('{{\'hello\'}}')
    expect(rendered).toContain('<view />')
  })

  it('warns when map callback is invalid and falls back to a dynamic island', () => {
    const context = createJsxCompileContext()
    const rendered = compileRenderableExpression(
      t.callExpression(
        t.memberExpression(t.identifier('list'), t.identifier('map')),
        [t.identifier('renderItem')],
      ),
      context,
    )

    expect(rendered).toContain('data-wv-jsx-island="i0"')
    expect(context.warnings).toContain('仅支持 map(fn) 形式的列表渲染。')
  })

  it('routes spread children and member tags to deterministic dynamic islands', () => {
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
          ),
        ],
      ) as any,
      context,
    )

    expect(rendered).toContain('data-wv-jsx-island="i0"')
    expect(rendered).toContain('data-wv-jsx-island="i1"')
    expect(context.dynamicIslands).toEqual([
      expect.objectContaining({ id: 'i0', reason: 'spread-child' }),
      expect.objectContaining({ id: 'i1', reason: 'dynamic-component' }),
    ])
    expect(context.warnings).toContain('JSX spread child 无法映射为静态 WXML，已生成 dynamic island。')
    expect(context.warnings).toContain('JSX 成员标签（如 <Foo.Bar />）无法映射为小程序 WXML 组件标签，已生成 dynamic island。')
  })

  it('renders logical-or fallback and list map blocks', () => {
    const context = createJsxCompileContext()
    const fallback = compileRenderableExpression(
      t.logicalExpression('||', t.identifier('ready'), t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('text'), [], false),
        t.jsxClosingElement(t.jsxIdentifier('text')),
        [t.jsxText('fallback')],
      )),
      context,
    )

    expect(fallback).toContain(`${defaultPlatform.directives.ifAttr}="{{!(ready)}}"`)
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
            ),
          ),
        ],
      ),
      context,
    )

    expect(list).toContain(`${defaultPlatform.directives.forAttr}="{{list}}"`)
    expect(list).toContain(`${defaultPlatform.directives.keyAttr}="index"`)
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

    expect(conditional).toContain(`${defaultPlatform.directives.ifAttr}="{{ready}}"`)
    expect(conditional).toContain('<view />')
    expect(logicalAnd).toContain(`${defaultPlatform.directives.ifAttr}="{{visible}}"`)
    expect(logicalAnd).toContain('<text>shown</text>')
    expect(fallbackCall).toContain('data-wv-jsx-island="i0"')
    expect(context.dynamicIslands).toEqual([
      expect.objectContaining({ reason: 'unsupported-call' }),
    ])
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
      ),
      context,
    )

    expect(mappedText).toContain(`${defaultPlatform.directives.keyAttr}="index"`)
    expect(mappedText).toContain('{{item}}')
    expect(emptyBody).toBe('')
    expect(sparseArray).toContain('{{\'tail\'}}')
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
        ),
        t.jsxElement(
          t.jsxOpeningElement(t.jsxIdentifier('text'), [], false),
          t.jsxClosingElement(t.jsxIdentifier('text')),
          [t.jsxText('no')],
        ),
      ),
      context,
    )

    expect(list).toContain(`${defaultPlatform.directives.keyAttr}="index"`)
    expect(conditional).toContain(`${defaultPlatform.directives.ifAttr}="{{ready}}"`)
    expect(conditional).toContain(defaultPlatform.directives.elseAttr)
    expect(conditional).toContain('<text>no</text>')
  })

  it('renders structural directives with the selected mini program platform prefix', () => {
    const ttContext = createJsxCompileContext({
      template: {
        platform: getMiniProgramTemplatePlatform('tt'),
      },
    } as any)
    const alipayContext = createJsxCompileContext({
      template: {
        platform: getMiniProgramTemplatePlatform('alipay'),
      },
    } as any)
    const swanContext = createJsxCompileContext({
      template: {
        platform: getMiniProgramTemplatePlatform('swan'),
      },
    } as any)

    const listExpression = t.callExpression(
      t.memberExpression(t.identifier('list'), t.identifier('map')),
      [
        t.arrowFunctionExpression(
          [t.identifier('item'), t.identifier('index')],
          t.jsxElement(
            t.jsxOpeningElement(t.jsxIdentifier('view'), [], false),
            t.jsxClosingElement(t.jsxIdentifier('view')),
            [t.jsxExpressionContainer(t.identifier('item'))],
          ),
        ),
      ],
    )
    const conditionalExpression = t.conditionalExpression(
      t.identifier('ready'),
      t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('text'), [], false),
        t.jsxClosingElement(t.jsxIdentifier('text')),
        [t.jsxText('yes')],
      ),
      t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('text'), [], false),
        t.jsxClosingElement(t.jsxIdentifier('text')),
        [t.jsxText('no')],
      ),
    )

    expect(compileRenderableExpression(listExpression, ttContext)).toContain('tt:for="{{list}}"')
    expect(compileRenderableExpression(listExpression, alipayContext)).toContain('a:for="{{list}}"')
    expect(compileRenderableExpression(listExpression, swanContext)).toContain('s-for="{{list}}"')
    expect(compileRenderableExpression(conditionalExpression, ttContext)).toContain('tt:if="{{ready}}"')
    expect(compileRenderableExpression(conditionalExpression, alipayContext)).toContain('a:if="{{ready}}"')
    expect(compileRenderableExpression(conditionalExpression, swanContext)).toContain('s-if="{{ready}}"')
  })

  function viewChild(text: string) {
    return t.jsxElement(
      t.jsxOpeningElement(t.jsxIdentifier('view'), [], false),
      t.jsxClosingElement(t.jsxIdentifier('view')),
      [t.jsxText(text)],
    )
  }

  function jsxTeleport(attributes: any[], children: any[] = []) {
    const selfClosing = children.length === 0
    return t.jsxElement(
      t.jsxOpeningElement(t.jsxIdentifier('Teleport'), attributes, selfClosing),
      selfClosing ? null : t.jsxClosingElement(t.jsxIdentifier('Teleport')),
      children,
    )
  }

  it('maps JSX Teleport with a static target to root-portal', () => {
    const context = createJsxCompileContext()
    const rendered = compileRenderableExpression(
      jsxTeleport(
        [t.jsxAttribute(t.jsxIdentifier('to'), t.stringLiteral('body'))],
        [viewChild('A')],
      ),
      context,
    )

    expect(rendered).toBe('<root-portal enable="{{true}}"><view>A</view></root-portal>')
    expect(context.bindingManifest.features.rootPortal).toBe(true)
    expect(context.warnings).toHaveLength(0)
  })

  it('inverts JSX Teleport disabled semantics for root-portal enable', () => {
    const bare = compileRenderableExpression(
      jsxTeleport([
        t.jsxAttribute(t.jsxIdentifier('to'), t.stringLiteral('body')),
        t.jsxAttribute(t.jsxIdentifier('disabled'), null),
      ]),
      createJsxCompileContext(),
    )
    const falseLiteral = compileRenderableExpression(
      jsxTeleport([
        t.jsxAttribute(t.jsxIdentifier('to'), t.stringLiteral('body')),
        t.jsxAttribute(t.jsxIdentifier('disabled'), t.jsxExpressionContainer(t.booleanLiteral(false))),
      ]),
      createJsxCompileContext(),
    )
    const dynamic = compileRenderableExpression(
      jsxTeleport([
        t.jsxAttribute(t.jsxIdentifier('to'), t.stringLiteral('body')),
        t.jsxAttribute(t.jsxIdentifier('disabled'), t.jsxExpressionContainer(t.identifier('isDisabled'))),
      ]),
      createJsxCompileContext(),
    )

    expect(bare).toContain('enable="{{false}}"')
    expect(falseLiteral).toContain('enable="{{true}}"')
    expect(dynamic).toContain('enable="{{!(isDisabled)}}"')
  })

  it('degrades JSX Teleport without a static target and keeps children', () => {
    const dynamicContext = createJsxCompileContext()
    const dynamic = compileRenderableExpression(
      jsxTeleport(
        [t.jsxAttribute(t.jsxIdentifier('to'), t.jsxExpressionContainer(t.identifier('target')))],
        [viewChild('A')],
      ),
      dynamicContext,
    )
    expect(dynamic).toBe('<view>A</view>')
    expect(dynamicContext.warnings.some(warning => warning.includes('动态 :to'))).toBe(true)

    const missingContext = createJsxCompileContext()
    const missing = compileRenderableExpression(jsxTeleport([], [viewChild('A')]), missingContext)
    expect(missing).toBe('<view>A</view>')
    expect(missingContext.warnings.some(warning => warning.includes('缺少必需的 to'))).toBe(true)

    const spreadContext = createJsxCompileContext()
    const spread = compileRenderableExpression(
      jsxTeleport([t.jsxSpreadAttribute(t.identifier('attrs'))], [viewChild('A')]),
      spreadContext,
    )
    expect(spread).toBe('<view>A</view>')
    expect(spreadContext.warnings.some(warning => warning.includes('v-bind'))).toBe(true)
  })

  it('degrades JSX Teleport on platforms without root-portal support', () => {
    const context = createJsxCompileContext({
      template: {
        platform: getMiniProgramTemplatePlatform('alipay'),
      },
    } as any)
    const rendered = compileRenderableExpression(
      jsxTeleport(
        [t.jsxAttribute(t.jsxIdentifier('to'), t.stringLiteral('body'))],
        [viewChild('A')],
      ),
      context,
    )

    expect(rendered).toBe('<view>A</view>')
    expect(context.warnings.some(warning => warning.includes('仅在微信平台'))).toBe(true)
  })

  it('keeps v-if and v-show semantics when mapping JSX Teleport', () => {
    const context = createJsxCompileContext()
    const rendered = compileRenderableExpression(
      jsxTeleport(
        [
          t.jsxAttribute(t.jsxIdentifier('to'), t.stringLiteral('body')),
          t.jsxAttribute(t.jsxIdentifier('v-if'), t.jsxExpressionContainer(t.identifier('show'))),
          t.jsxAttribute(t.jsxIdentifier('v-show'), t.jsxExpressionContainer(t.identifier('visible'))),
        ],
        [viewChild('A')],
      ),
      context,
    )

    expect(rendered).toContain(`${defaultPlatform.directives.ifAttr}="{{show}}"`)
    expect(rendered).toContain('hidden="{{!(visible)}}"')
    expect(rendered).toContain('<root-portal')
  })

  it('warns when JSX Teleport class/style is attached to the root-portal host', () => {
    const context = createJsxCompileContext()
    const rendered = compileRenderableExpression(
      jsxTeleport(
        [
          t.jsxAttribute(t.jsxIdentifier('to'), t.stringLiteral('body')),
          t.jsxAttribute(t.jsxIdentifier('class'), t.stringLiteral('overlay')),
        ],
        [viewChild('A')],
      ),
      context,
    )

    expect(rendered).toContain('class="overlay"')
    expect(context.warnings.some(warning => warning.includes('class/style'))).toBe(true)
  })

  it('disables JSX Teleport mapping through compiler options', () => {
    const context = createJsxCompileContext({
      template: {
        teleport: { enabled: false },
      },
    } as any)
    const rendered = compileRenderableExpression(
      jsxTeleport(
        [t.jsxAttribute(t.jsxIdentifier('to'), t.stringLiteral('body'))],
        [viewChild('A')],
      ),
      context,
    )

    expect(rendered).toBe('<view>A</view>')
    expect(context.warnings).toHaveLength(0)
    expect(context.bindingManifest.features.rootPortal).toBeUndefined()
  })
})
