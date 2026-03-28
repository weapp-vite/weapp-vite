import * as t from '@babel/types'
import { describe, expect, it } from 'vitest'
import * as babelModule from './babel'
import * as engineModule from './engine'
import {
  BABEL_TS_MODULE_PARSER_OPTIONS,
  collectJsxImportedComponentsAndDefaultExportFromBabelAst,
  collectJsxTemplateTagsFromBabelExpression,
  collectLoopScopeAliases,
  createLineStartOffsets,
  createWarningPrefix,
  defaultIsDefineComponentSource,
  extractTemplateExpressions,
  getLocationFromOffset,
  getMemberExpressionPropertyName,
  getObjectPropertyByKey,
  getOxcMemberExpressionPropertyName,
  getOxcStaticPropertyName,
  getRenderPropertyFromComponentOptions,
  getStaticPropertyName,
  getStaticRequireLiteralValue,
  isPlatformApiIdentifier,
  isStaticPropertyName,
  mapConstructorName,
  mayContainComponentPropsShape,
  mayContainFeatureFlagHints,
  mayContainJsxAutoComponentEntry,
  mayContainPlatformApiAccess,
  mayContainPlatformApiIdentifierByText,
  mayContainRelevantScriptSetupImports,
  mayContainRequireCallByText,
  mayContainStaticRequireLiteral,
  parse,
  parseJsLikeWithEngine,
  platformApiIdentifierList,
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

  it('fast rejects unrelated script setup import analysis before parsing', () => {
    const babelParseSpy = vi.spyOn(babelModule, 'parse')
    const engineParseSpy = vi.spyOn(engineModule, 'parseJsLikeWithEngine')
    const source = `
const count = 1
export function useCounter() {
  return count
}
`

    expect(collectScriptSetupImportsFromCode(source, new Set(['FooCard']), { astEngine: 'babel' })).toEqual([])
    expect(collectScriptSetupImportsFromCode(source, new Set(['FooCard']), { astEngine: 'oxc' })).toEqual([])
    expect(collectScriptSetupImportsFromCode(`import Bar from './Bar'`, new Set(['FooCard']), { astEngine: 'babel' })).toEqual([])
    expect(collectScriptSetupImportsFromCode(`import Bar from './Bar'`, new Set(['FooCard']), { astEngine: 'oxc' })).toEqual([])
    expect(babelParseSpy).not.toHaveBeenCalled()
    expect(engineParseSpy).not.toHaveBeenCalled()

    babelParseSpy.mockRestore()
    engineParseSpy.mockRestore()
  })

  it('exposes script setup import prechecks', () => {
    expect(mayContainRelevantScriptSetupImports(`import FooCard from './FooCard'`, new Set(['FooCard']))).toBe(true)
    expect(mayContainRelevantScriptSetupImports(`import BarCard from './BarCard'`, new Set(['FooCard']))).toBe(false)
    expect(mayContainRelevantScriptSetupImports('const count = 1', new Set(['FooCard']))).toBe(false)
    expect(mayContainRelevantScriptSetupImports(`import FooCard from './FooCard'`, new Set())).toBe(false)
  })

  it('supports oxc fast prechecks', () => {
    expect(platformApiIdentifierList).toEqual(['wx', 'my', 'tt', 'swan', 'jd', 'xhs'])
    expect(isPlatformApiIdentifier('wx')).toBe(true)
    expect(isPlatformApiIdentifier('console')).toBe(false)
    expect(mayContainPlatformApiIdentifierByText('const value = my.request({})')).toBe(true)
    expect(mayContainPlatformApiIdentifierByText('const value = localStorage.getItem("x")')).toBe(false)
    expect(mayContainPlatformApiAccess('const value = wx.getStorageSync("x")', { engine: 'oxc' })).toBe(true)
    expect(mayContainPlatformApiAccess('const value = localStorage.getItem("x")', { engine: 'oxc' })).toBe(false)
    expect(mayContainStaticRequireLiteral('const mod = require("./dep")', { engine: 'oxc' })).toBe(true)
    expect(mayContainStaticRequireLiteral('const mod = require(name)', { engine: 'oxc' })).toBe(false)
  })

  it('fast rejects oxc prechecks before parsing when text hints are absent', () => {
    const engineParseSpy = vi.spyOn(engineModule, 'parseJsLikeWithEngine')
    const source = `
import { ref } from 'vue'

export function useCounter() {
  return ref(1)
}
`

    expect(mayContainPlatformApiAccess(source, { engine: 'oxc' })).toBe(false)
    expect(mayContainStaticRequireLiteral(source, { engine: 'oxc' })).toBe(false)
    expect(engineParseSpy).not.toHaveBeenCalled()

    engineParseSpy.mockRestore()
  })

  it('exposes require prechecks', () => {
    expect(mayContainRequireCallByText(`const dep = require('./dep')`)).toBe(true)
    expect(mayContainRequireCallByText('const dep = load("./dep")')).toBe(false)
    expect(getStaticRequireLiteralValue({ type: 'StringLiteral', value: './dep' })).toBe('./dep')
    expect(getStaticRequireLiteralValue({
      type: 'TemplateLiteral',
      expressions: [],
      quasis: [{ value: { cooked: './tmpl' } }],
    })).toBe('./tmpl')
    expect(getStaticRequireLiteralValue({ type: 'Identifier', name: 'dep' })).toBeNull()
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

  it('fast rejects unrelated component prop sources before parsing', () => {
    const babelParseSpy = vi.spyOn(babelModule, 'parse')
    const engineParseSpy = vi.spyOn(engineModule, 'parseJsLikeWithEngine')
    const source = `
import { ref } from 'vue'

export function useCounter() {
  return ref(1)
}
`

    expect(collectComponentPropsFromCode(source, { astEngine: 'babel' })).toEqual(new Map())
    expect(collectComponentPropsFromCode(source, { astEngine: 'oxc' })).toEqual(new Map())
    expect(babelParseSpy).not.toHaveBeenCalled()
    expect(engineParseSpy).not.toHaveBeenCalled()

    babelParseSpy.mockRestore()
    engineParseSpy.mockRestore()
  })

  it('exposes component prop prechecks', () => {
    expect(mayContainComponentPropsShape('Component({ properties: { title: String } })')).toBe(true)
    expect(mayContainComponentPropsShape('const value = ref(1)')).toBe(false)
    expect(mapConstructorName('String')).toBe('string')
    expect(mapConstructorName('BooleanConstructor')).toBe('boolean')
    expect(mapConstructorName('CustomCtor')).toBe('any')
    expect(getStaticPropertyName({ type: 'Identifier', name: 'title' })).toBe('title')
    expect(getStaticPropertyName({ type: 'StringLiteral', value: 'count' })).toBe('count')
    expect(getStaticPropertyName({ type: 'NumericLiteral', value: 2 })).toBe('2')
    expect(getStaticPropertyName({ type: 'TemplateLiteral' })).toBeUndefined()
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

  it('fast rejects unrelated feature flag sources before parsing', () => {
    const babelParseSpy = vi.spyOn(babelModule, 'parseJsLike')
    const engineParseSpy = vi.spyOn(engineModule, 'parseJsLikeWithEngine')
    const source = `
import { ref } from 'vue'

export function useCounter() {
  return ref(1)
}
`
    const options = {
      moduleId: 'wevu',
      hookToFeature: {
        onLoad: 'enableLoad',
        onShow: 'enableShow',
      } as const,
    }

    expect(collectFeatureFlagsFromCode(source, {
      ...options,
      astEngine: 'babel',
    })).toEqual(new Set())
    expect(collectFeatureFlagsFromCode(source, {
      ...options,
      astEngine: 'oxc',
    })).toEqual(new Set())
    expect(babelParseSpy).not.toHaveBeenCalled()
    expect(engineParseSpy).not.toHaveBeenCalled()

    babelParseSpy.mockRestore()
    engineParseSpy.mockRestore()
  })

  it('exposes feature flag text hint checks', () => {
    const hookToFeature = {
      onLoad: 'enableLoad',
      onShow: 'enableShow',
    } as const

    expect(mayContainFeatureFlagHints(`import { onLoad } from 'wevu'`, 'wevu', hookToFeature)).toBe(true)
    expect(mayContainFeatureFlagHints(`import { onReady } from 'wevu'`, 'wevu', hookToFeature)).toBe(false)
    expect(mayContainFeatureFlagHints(`import { onLoad } from 'vue'`, 'wevu', hookToFeature)).toBe(false)
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

  it('exposes jsx auto component prechecks', () => {
    expect(defaultIsDefineComponentSource('vue')).toBe(true)
    expect(defaultIsDefineComponentSource('wevu')).toBe(false)
    expect(mayContainJsxAutoComponentEntry(`import Foo from './Foo'`)).toBe(true)
    expect(mayContainJsxAutoComponentEntry('export default page')).toBe(true)
    expect(mayContainJsxAutoComponentEntry('const page = createPage()')).toBe(false)
  })

  it('fast rejects jsx auto component analysis without imports or default export', () => {
    const babelParseSpy = vi.spyOn(babelModule, 'parse')
    const source = `
const count = 1
export function useCounter() {
  return count + 1
}
`

    const babelResult = collectJsxAutoComponentsFromCode(source, {
      astEngine: 'babel',
      isCollectableTag: () => true,
    })
    const oxcResult = collectJsxAutoComponentsFromCode(source, {
      astEngine: 'oxc',
      isCollectableTag: () => true,
    })

    expect(babelResult).toEqual({
      templateTags: new Set(),
      importedComponents: [],
    })
    expect(oxcResult).toEqual({
      templateTags: new Set(),
      importedComponents: [],
    })
    expect(babelParseSpy).not.toHaveBeenCalled()

    babelParseSpy.mockRestore()
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

  it('keeps onPageScroll warnings aligned across engines', () => {
    const source = `import * as wevu from 'wevu'

const page = {
  onPageScroll() {
    this.setData({ top: 1 })
    wx.getStorageSync('k')
  },
}

wevu.onPageScroll?.(() => {})`

    const babelWarnings = collectOnPageScrollPerformanceWarnings(source, '/src/pages/index.ts', { engine: 'babel' })
    const oxcWarnings = collectOnPageScrollPerformanceWarnings(source, '/src/pages/index.ts', { engine: 'oxc' })
    const normalize = (warning: string) => warning.replace(/^.*?:\d+:\d+\s/, '')

    expect(oxcWarnings.map(normalize)).toEqual(babelWarnings.map(normalize))
  })

  it('ignores nested function body calls in onPageScroll inspection across engines', () => {
    const source = `import { onPageScroll } from 'wevu'

onPageScroll(() => {
  const run = () => {
    this.setData({ top: 1 })
    wx.getStorageSync('k')
  }

  return run
})`

    expect(collectOnPageScrollPerformanceWarnings(source, '/src/pages/index.ts', { engine: 'babel' })).toEqual([])
    expect(collectOnPageScrollPerformanceWarnings(source, '/src/pages/index.ts', { engine: 'oxc' })).toEqual([])
  })

  it('fast rejects onPageScroll diagnostics when source text is absent', () => {
    const parseSpy = vi.spyOn(babelModule, 'parseJsLike')
    const source = `
import { ref } from 'vue'

export function useCounter() {
  return ref(1)
}
`

    expect(collectOnPageScrollPerformanceWarnings(source, '/src/pages/index.ts', { engine: 'babel' })).toEqual([])
    expect(collectOnPageScrollPerformanceWarnings(source, '/src/pages/index.ts', { engine: 'oxc' })).toEqual([])
    expect(parseSpy).not.toHaveBeenCalled()

    parseSpy.mockRestore()
  })

  it('exposes onPageScroll location helpers', () => {
    const lineStarts = createLineStartOffsets('first\nsecond\nthird')

    expect(lineStarts).toEqual([0, 6, 13])
    expect(getLocationFromOffset(0, lineStarts)).toEqual({ line: 1, column: 1 })
    expect(getLocationFromOffset(8, lineStarts)).toEqual({ line: 2, column: 3 })
    expect(getLocationFromOffset(undefined, lineStarts)).toBeUndefined()
    expect(isStaticPropertyName(t.identifier('onPageScroll'))).toBe('onPageScroll')
    expect(isStaticPropertyName(t.stringLiteral('render'))).toBe('render')
    expect(isStaticPropertyName(t.privateName(t.identifier('secret')))).toBeUndefined()
    expect(getMemberExpressionPropertyName(t.memberExpression(t.identifier('wx'), t.identifier('setData')))).toBe('setData')
    expect(getMemberExpressionPropertyName(t.memberExpression(t.identifier('wx'), t.stringLiteral('getStorageSync'), true))).toBe('getStorageSync')
    expect(getOxcStaticPropertyName({ type: 'Identifier', name: 'onPageScroll' })).toBe('onPageScroll')
    expect(getOxcStaticPropertyName({ type: 'StringLiteral', value: 'render' })).toBe('render')
    expect(getOxcStaticPropertyName({ type: 'Literal', value: 'type' })).toBe('type')
    expect(getOxcStaticPropertyName({ type: 'NumericLiteral', value: 1 })).toBeUndefined()
    expect(getOxcMemberExpressionPropertyName({
      type: 'MemberExpression',
      computed: false,
      property: { type: 'Identifier', name: 'setData' },
    })).toBe('setData')
    expect(getOxcMemberExpressionPropertyName({
      type: 'MemberExpression',
      computed: true,
      property: { type: 'StringLiteral', value: 'getStorageSync' },
    })).toBe('getStorageSync')
    expect(getOxcMemberExpressionPropertyName({
      type: 'MemberExpression',
      computed: true,
      property: { type: 'NumericLiteral', value: 1 },
    })).toBeUndefined()
    expect(createWarningPrefix('/src/pages/index.ts')).toBe('[weapp-vite][onPageScroll] /src/pages/index.ts:?:?')
    expect(createWarningPrefix('/src/pages/index.ts', 2, 3)).toBe('[weapp-vite][onPageScroll] /src/pages/index.ts:2:3')
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

  it('keeps setData pick scope analysis aligned across engines', () => {
    const template = `
<text>{{ list.map((item, index) => item.name + index + count + this.extra) }}</text>
    `.trim()

    expect(collectSetDataPickKeysFromTemplateCode(template, { astEngine: 'babel' })).toEqual(['count', 'extra', 'list'])
    expect(collectSetDataPickKeysFromTemplateCode(template, { astEngine: 'oxc' })).toEqual(['count', 'extra', 'list'])
  })

  it('fast rejects setData pick analysis without mustache expressions', () => {
    const babelParseSpy = vi.spyOn(babelModule, 'parse')
    const engineParseSpy = vi.spyOn(engineModule, 'parseJsLikeWithEngine')
    const template = `<view class="plain"><text>static</text></view>`

    expect(collectSetDataPickKeysFromTemplateCode(template, { astEngine: 'babel' })).toEqual([])
    expect(collectSetDataPickKeysFromTemplateCode(template, { astEngine: 'oxc' })).toEqual([])
    expect(babelParseSpy).not.toHaveBeenCalled()
    expect(engineParseSpy).not.toHaveBeenCalled()

    babelParseSpy.mockRestore()
    engineParseSpy.mockRestore()
  })

  it('exposes setData pick template helpers', () => {
    expect(extractTemplateExpressions('<text>{{ count }}</text><view>{{ list.length }}</view>')).toEqual(['count', 'list.length'])
    expect(extractTemplateExpressions('<view>static</view>')).toEqual([])
    expect([...collectLoopScopeAliases('<view wx:for="{{ list }}"></view>')]).toEqual(['item', 'index'])
    expect([...collectLoopScopeAliases('<view wx:for="{{ list }}" wx:for-item="row" wx:for-index="i"></view>')]).toEqual(['row', 'i'])
  })
})
