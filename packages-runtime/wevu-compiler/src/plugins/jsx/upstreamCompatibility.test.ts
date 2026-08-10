import { describe, expect, it } from 'vitest'
import { compileJsxTemplate } from './compileJsx/template'
import { UPSTREAM_COMPATIBILITY_CASES, UPSTREAM_COMPATIBILITY_SOURCES } from './upstreamCompatibility'

function componentSource(renderSource: string) {
  return `export default { render() { return (${renderSource}) } }`
}

const NATIVE_WXML_EXPECTATIONS: Record<string, string> = {
  'fragment': '<view>A</view><text>B</text>',
  'static-attrs': 'id="root"',
  'dynamic-attrs': 'placeholder="{{placeholder}}"',
  'native-events': 'bindtap="tap"',
  'component-events': 'bindchange="change"',
  'conditional': 'wx:if="{{ok}}"',
  'logical-and': 'wx:if="{{ok}}"',
  'logical-or': 'wx:if="{{!(ok)}}"',
  'list': 'wx:for="{{list}}"',
  'array-children': '<view>A</view><text>B</text>',
  'static-spread-props': 'id="root"',
  'static-spread-string-key': 'data-kind="card"',
  'static-class-array': 'class="card active"',
  'static-class-object': 'class="card"',
  'static-style-object': 'style="color:red;font-size:12px"',
  'v-if': 'wx:if="{{ready}}"',
  'v-show': 'hidden="{{!(visible)}}"',
  'v-text': '<text>{{label}}</text>',
}

describe('Vue 3.5.41 / babel-plugin-jsx 3.0.0 compatibility matrix', () => {
  it('keeps every adapted upstream category explicitly classified', () => {
    const categories = new Set(UPSTREAM_COMPATIBILITY_CASES.map(item => item.category))
    expect(categories.size).toBe(UPSTREAM_COMPATIBILITY_CASES.length)
    for (const category of [
      'fragment',
      'v-model',
      'object-slots',
      'dynamic-spread-props',
      'teleport',
    ]) {
      expect(categories.has(category)).toBe(true)
    }
    expect(UPSTREAM_COMPATIBILITY_SOURCES).toEqual({
      vueCore: { repository: 'vuejs/core', tag: 'v3.5.41', license: 'MIT' },
      vueJsx: { repository: 'vuejs/babel-plugin-jsx', tag: 'v3.0.0', license: 'MIT' },
    })
  })

  it.each(UPSTREAM_COMPATIBILITY_CASES.filter(item => item.mode === 'native-wxml'))(
    'compiles $category through native WXML',
    ({ source }) => {
      const compatibilityCase = UPSTREAM_COMPATIBILITY_CASES.find(item => item.source === source)!
      const result = compileJsxTemplate(componentSource(source), '/project/src/upstream.tsx')
      expect(result.template).toBeTruthy()
      expect(result.template).toContain(NATIVE_WXML_EXPECTATIONS[compatibilityCase.category])
      expect(result.dynamicIslands).toEqual([])
      expect(result.warnings.some(message => message.includes('已忽略'))).toBe(false)
    },
  )

  it('defines a stable WXML semantic assertion for every native category', () => {
    const nativeCategories = UPSTREAM_COMPATIBILITY_CASES
      .filter(item => item.mode === 'native-wxml')
      .map(item => item.category)
    expect(Object.keys(NATIVE_WXML_EXPECTATIONS).sort()).toEqual(nativeCategories.sort())
  })

  it.each(UPSTREAM_COMPATIBILITY_CASES.filter(item => item.mode === 'dynamic-island'))(
    'classifies $category as a dynamic island',
    ({ source }) => {
      const result = compileJsxTemplate(componentSource(source), '/project/src/upstream.tsx')
      expect(result.template).toContain('data-wv-jsx-island')
      expect(result.dynamicIslands?.length).toBeGreaterThan(0)
    },
  )

  it.each(UPSTREAM_COMPATIBILITY_CASES.filter(item => item.mode === 'runtime'))(
    'routes $category through the structured Wevu runtime island',
    ({ source }) => {
      const result = compileJsxTemplate(componentSource(source), '/project/src/upstream.tsx')
      expect(result.template).toContain('data-wv-jsx-island')
      expect(result.dynamicIslands).toEqual([
        expect.objectContaining({ reason: 'closure' }),
      ])
      expect(result.warnings.some(message => message.includes('已忽略'))).toBe(false)
    },
  )

  it.each(UPSTREAM_COMPATIBILITY_CASES.filter(item => item.mode === 'unsupported-diagnostic'))(
    'emits an explicit mini-program compatibility result for $category',
    ({ source }) => {
      const result = compileJsxTemplate(componentSource(source), '/project/src/upstream.tsx')
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings.some(message => message.includes('已忽略'))).toBe(false)
    },
  )

  it('maps Vue JSX structural and text directives to WXML', () => {
    const result = compileJsxTemplate(
      componentSource('<view v-if={ready} v-show={visible}><text v-text={label} /></view>'),
      '/project/src/directives.tsx',
    )
    expect(result.template).toContain('wx:if="{{ready}}"')
    expect(result.template).toContain('hidden="{{!(visible)}}"')
    expect(result.template).toContain('<text>{{label}}</text>')
  })
})
