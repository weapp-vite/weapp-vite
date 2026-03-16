import * as t from '@babel/types'
import { describe, expect, it } from 'vitest'
import {
  BABEL_TS_MODULE_PARSER_OPTIONS,
  collectJsxImportedComponentsAndDefaultExportFromBabelAst,
  collectJsxTemplateTagsFromBabelExpression,
  getObjectPropertyByKey,
  getRenderPropertyFromComponentOptions,
  mayContainPlatformApiAccess,
  mayContainStaticRequireLiteral,
  parse,
  parseJsLikeWithEngine,
  resolveRenderableExpression,
  resolveRenderExpressionFromComponentOptions,
  toStaticObjectKey,
  unwrapTypeScriptExpression,
} from './index'
import { collectComponentPropsFromCode } from './operations/componentProps'
import { collectFeatureFlagsFromCode } from './operations/featureFlags'
import { collectJsxAutoComponentsFromCode } from './operations/jsxAutoComponents'
import { collectOnPageScrollPerformanceWarnings } from './operations/onPageScroll'
import { collectScriptSetupImportsFromCode } from './operations/scriptSetupImports'
import { collectSetDataPickKeysFromTemplateCode } from './operations/setDataPick'

describe('@weapp-vite/ast', () => {
  it('supports babel and oxc engines', () => {
    expect(parseJsLikeWithEngine('export const value = 1')).toMatchObject({ type: 'File' })
    expect(parseJsLikeWithEngine('export const value = 1', { engine: 'oxc' })).toMatchObject({ type: 'Program' })
  })

  it('exposes reusable babel node helpers', () => {
    const wrapped = t.tsAsExpression(
      t.parenthesizedExpression(t.identifier('foo')),
      t.tsTypeReference(t.identifier('Foo')),
    )
    expect(unwrapTypeScriptExpression(wrapped)).toEqual(t.identifier('foo'))
    expect(toStaticObjectKey(t.identifier('render'))).toBe('render')

    const componentExpr = t.objectExpression([
      t.objectMethod(
        'method',
        t.identifier('render'),
        [],
        t.blockStatement([
          t.returnStatement(t.tsNonNullExpression(t.identifier('view'))),
        ]),
      ),
    ])

    const renderProp = getObjectPropertyByKey(componentExpr, 'render')
    expect(renderProp).not.toBeNull()
    expect(renderProp && resolveRenderableExpression(renderProp)).toEqual(t.identifier('view'))
    expect(getRenderPropertyFromComponentOptions(componentExpr)).toEqual(renderProp)
    expect(resolveRenderExpressionFromComponentOptions(componentExpr)).toEqual(t.identifier('view'))
  })

  it('keeps script setup import analysis aligned', () => {
    const source = `
import type { FooProps } from './types'
import FooCard, { BarButton as RenamedButton, BazText } from './components'
`
    const names = new Set(['FooCard', 'RenamedButton'])

    expect(collectScriptSetupImportsFromCode(source, names, { astEngine: 'babel' })).toEqual(
      collectScriptSetupImportsFromCode(source, names, { astEngine: 'oxc' }),
    )
  })

  it('supports oxc fast prechecks', () => {
    expect(mayContainPlatformApiAccess('const value = wx.getStorageSync("x")', { engine: 'oxc' })).toBe(true)
    expect(mayContainPlatformApiAccess('const value = localStorage.getItem("x")', { engine: 'oxc' })).toBe(false)
    expect(mayContainStaticRequireLiteral('const mod = require("./dep")', { engine: 'oxc' })).toBe(true)
    expect(mayContainStaticRequireLiteral('const mod = require(name)', { engine: 'oxc' })).toBe(false)
  })

  it('collects component props with babel and oxc', () => {
    const source = `
const options = {
  properties: {
    title: String,
    count: { type: Number, optionalTypes: [String] },
  },
}
Component(options)
`

    const expected = new Map([
      ['title', 'string'],
      ['count', 'number | string'],
    ])

    expect(collectComponentPropsFromCode(source, { astEngine: 'babel' })).toEqual(expected)
    expect(collectComponentPropsFromCode(source, { astEngine: 'oxc' })).toEqual(expected)
  })

  it('collects generic feature flags with babel and oxc', () => {
    const source = `
import { onLoad } from 'wevu'
import * as wevuNs from 'wevu'
onLoad(() => {})
wevuNs.onShow?.(() => {})
`

    const expected = new Set(['enableShare', 'enableShow'])
    const options = {
      moduleId: 'wevu',
      hookToFeature: {
        onLoad: 'enableShare',
        onShow: 'enableShow',
      } as const,
    }

    expect(collectFeatureFlagsFromCode(source, {
      ...options,
      astEngine: 'babel',
    })).toEqual(expected)
    expect(collectFeatureFlagsFromCode(source, {
      ...options,
      astEngine: 'oxc',
    })).toEqual(expected)
  })

  it('collects jsx auto components with babel and oxc', () => {
    const source = `
import { defineComponent as defineWevuComponent } from 'wevu'
import TButton from '@/components/TButton'
import { CardItem as TCard } from '@/components/TCard'

const page = defineWevuComponent({
  render() {
    return <view>
      <TButton />
      {ok ? <TCard /> : <text />}
    </view>
  },
})

export default page
`

    const babelResult = collectJsxAutoComponentsFromCode(source, {
      astEngine: 'babel',
      isCollectableTag: tag => !['view', 'text'].includes(tag),
      isDefineComponentSource: source => source === 'wevu' || source === 'vue',
    })
    const oxcResult = collectJsxAutoComponentsFromCode(source, {
      astEngine: 'oxc',
      isCollectableTag: tag => !['view', 'text'].includes(tag),
      isDefineComponentSource: source => source === 'wevu' || source === 'vue',
    })

    expect(babelResult).toEqual(oxcResult)
    expect([...oxcResult.templateTags]).toEqual(['TButton', 'TCard'])
    expect(oxcResult.importedComponents).toEqual([
      {
        localName: 'defineWevuComponent',
        importSource: 'wevu',
        importedName: 'defineComponent',
        kind: 'named',
      },
      {
        localName: 'TButton',
        importSource: '@/components/TButton',
        importedName: 'default',
        kind: 'default',
      },
      {
        localName: 'TCard',
        importSource: '@/components/TCard',
        importedName: 'CardItem',
        kind: 'named',
      },
    ])
  })

  it('collects imported components and default export from babel ast', () => {
    const ast = parse(`
import { defineComponent as defineWevuComponent } from 'wevu'
import TButton from '@/components/TButton'

const page = defineWevuComponent({
  render() {
    return <TButton />
  },
})

export default page
`, BABEL_TS_MODULE_PARSER_OPTIONS) as t.File

    const result = collectJsxImportedComponentsAndDefaultExportFromBabelAst(ast, {
      isDefineComponentSource: source => source === 'wevu' || source === 'vue',
    })

    expect(result.importedComponents).toEqual([
      {
        localName: 'defineWevuComponent',
        importSource: 'wevu',
        importedName: 'defineComponent',
        kind: 'named',
      },
      {
        localName: 'TButton',
        importSource: '@/components/TButton',
        importedName: 'default',
        kind: 'default',
      },
    ])
    expect(result.exportDefaultExpression).toMatchObject({ type: 'ObjectExpression' })
  })

  it('collects jsx template tags from babel expression', () => {
    const renderExpression = t.jsxFragment(
      t.jsxOpeningFragment(),
      t.jsxClosingFragment(),
      [
        t.jsxElement(
          t.jsxOpeningElement(t.jsxIdentifier('TButton'), [], true),
          null,
          [],
          true,
        ),
        t.jsxExpressionContainer(
          t.conditionalExpression(
            t.identifier('ok'),
            t.jsxElement(
              t.jsxOpeningElement(t.jsxIdentifier('FooCell'), [], true),
              null,
              [],
              true,
            ),
            t.jsxElement(
              t.jsxOpeningElement(t.jsxIdentifier('view'), [], true),
              null,
              [],
              true,
            ),
          ),
        ),
      ],
    )

    const tags = collectJsxTemplateTagsFromBabelExpression(renderExpression, tag => tag !== 'view')
    expect([...tags]).toEqual(['TButton', 'FooCell'])
  })

  it('collects onPageScroll warnings', () => {
    const source = `import { onPageScroll as onScroll } from 'wevu'

onScroll(() => {
  this.setData({ top: 1 })
  wx.getStorageSync('k')
})`

    const warnings = collectOnPageScrollPerformanceWarnings(source, '/src/pages/index.ts')
    expect(warnings.length).toBe(2)
    expect(warnings[0]).toContain('onPageScroll(...) 内调用 setData')
    expect(warnings[1]).toContain('wx.getStorageSync')
  })

  it('collects setData pick keys across engine options', () => {
    const template = `
<view wx:for="{{ list }}" wx:for-item="row" wx:for-index="i">
  <text>{{ row.name }}</text>
  <text>{{ __wv_bind_0[i] }}</text>
</view>
<text>{{ count > 0 ? count : 0 }}</text>
    `.trim()

    expect(collectSetDataPickKeysFromTemplateCode(template, { astEngine: 'babel' })).toEqual(['__wv_bind_0', 'count', 'list'])
    expect(collectSetDataPickKeysFromTemplateCode(template, { astEngine: 'oxc' })).toEqual(['__wv_bind_0', 'count', 'list'])
  })
})
