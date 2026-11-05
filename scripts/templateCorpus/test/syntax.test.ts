import type { CorpusProfile } from '../types'
import { describe, expect, it } from 'vitest'
import { syntaxCases } from '../assertions/syntax'

function profile(platform: string, rawTags: string[]): CorpusProfile {
  return { id: `${platform}-fixture`, platform, syntax: 'xml', rawTags, resolver: 'none' }
}

// 验收期望独立保存，不能从被测 parser 的生产预设生成同一份 oracle。
const directiveFixtures = [
  { platform: 'jd', source: '<view wx:if="{{visible}}" wx:for="{{items}}" bindtap="tap" capture-bind:tap="capture" catch:touchstart="stop"/>' },
  { platform: 'xhs', source: '<view wx:if="{{visible}}" wx:for="{{items}}" bindtap="tap" capture-bind:tap="capture" catch:touchstart="stop"/>' },
] as const

describe('independent platform syntax fixtures', () => {
  it.each(directiveFixtures)('uses the native wx directive namespace for $platform', ({ platform, source }) => {
    const testCase = syntaxCases(profile(platform, [])).find(testCase => testCase.name === 'platform-directives-events')
    expect(testCase).toEqual({ name: 'platform-directives-events', source, expectation: 'valid' })
  })

  it('uses Alipay native name/from attributes and ESM without changing generic raw cases', () => {
    const cases = syntaxCases(profile('alipay', ['import-sjs', 'sjs', 'opaque']))
    expect(cases.find(testCase => testCase.name === 'raw-import-sjs-external-module')).toEqual({
      name: 'raw-import-sjs-external-module',
      source: '<import-sjs name="test" from="./module.sjs"/><view/>',
      expectation: 'valid',
    })
    expect(cases.find(testCase => testCase.name === 'raw-import-sjs-pseudo-markup')).toEqual({
      name: 'raw-import-sjs-pseudo-markup',
      source: '<import-sjs name="test">const fake="</import-sjs><fake/>"; const regexp=/<fake[>]/; export default {};</import-sjs><view/>',
      expectation: 'valid',
    })
    for (const tag of ['sjs', 'opaque']) {
      expect(cases.find(testCase => testCase.name === `raw-${tag}-external-module`)?.source).toBe(`<${tag} module="test" src="./module.js"/><view/>`)
    }
  })

  it('keeps Baidu import-sjs attributes distinct from Alipay', () => {
    const cases = syntaxCases(profile('swan', ['import-sjs', 'filter']))
    expect(cases.find(testCase => testCase.name === 'raw-import-sjs-external-module')?.source).toBe('<import-sjs module="test" src="./module.js"/><view/>')
    expect(cases.find(testCase => testCase.name === 'raw-filter-pseudo-markup')?.source).toContain('<filter module="test">')
  })

  it('keeps every explicitly registered generic raw tag in both boundary scenarios', () => {
    const rawTags = ['opaque', 'script', 'filter', 'jds', 'qs', 'dds', 'qjs', 'hjs', 'import-sjs']
    const cases = syntaxCases(profile('generic-fixture', rawTags))
    expect(cases.filter(testCase => testCase.name.startsWith('raw-')).map(testCase => testCase.name)).toEqual(
      rawTags.flatMap(tag => [`raw-${tag}-pseudo-markup`, `raw-${tag}-external-module`]),
    )
    for (const tag of rawTags) {
      expect(cases.find(testCase => testCase.name === `raw-${tag}-external-module`)?.source).toBe(`<${tag} module="test" src="./module.js"/><view/>`)
      expect(cases.find(testCase => testCase.name === `raw-${tag}-pseudo-markup`)?.source).toContain(`const fake="</${tag}><fake/>"`)
    }
  })
})
