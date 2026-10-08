import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { observeNativeAnalysis } from '../../ast/src/native/observation'

const mixedBody = `wx.getStorageSync('key')
  this.setData({ top: 1 })`
const cases = [
  {
    name: 'multiline function callback',
    source: `import { onPageScroll } from 'wevu'
const dependency = require('./dependency')
onPageScroll(function () {
  ${mixedBody}
})`,
    warnings: 2,
  },
  { name: 'block arrow callback', source: `onPageScroll(() => { ${mixedBody} })`, warnings: 2 },
  { name: 'expression arrow callback', source: 'onPageScroll(() => this.setData({ top: 1 }))', warnings: 1 },
  { name: 'object method', source: `const page = { onPageScroll() { ${mixedBody} } }`, warnings: 2 },
  { name: 'empty object method', source: 'const page = { onPageScroll() {} }', warnings: 1 },
  { name: 'async object method', source: `const page = { async onPageScroll() { ${mixedBody} } }`, warnings: 2 },
  { name: 'generator object method', source: `const page = { *onPageScroll() { ${mixedBody} } }`, warnings: 2 },
  { name: 'quoted object method', source: `const page = { 'onPageScroll'() { ${mixedBody} } }`, warnings: 2 },
  { name: 'computed object method', source: `const page = { ['onPageScroll']() { ${mixedBody} } }`, warnings: 2 },
  { name: 'computed identifier method', source: `const page = { [onPageScroll]() { ${mixedBody} } }`, warnings: 2 },
  { name: 'getter method', source: `const page = { get onPageScroll() { ${mixedBody} } }`, warnings: 2 },
  { name: 'setter method', source: `const page = { set onPageScroll(value) { ${mixedBody} } }`, warnings: 2 },
  { name: 'function property', source: `const page = { onPageScroll: function () { ${mixedBody} } }`, warnings: 2 },
  { name: 'arrow property', source: 'const page = { onPageScroll: () => wx.getStorageSync("key") }', warnings: 1 },
  { name: 'computed property exclusion', source: `const page = { ['onPageScroll']: () => { ${mixedBody} } }`, warnings: 0 },
  { name: 'aliased hook', source: `import { onPageScroll as scroll } from 'wevu'; scroll(() => { ${mixedBody} })`, warnings: 2 },
  { name: 'string import exclusion', source: `import { 'onPageScroll' as scroll } from 'wevu'; scroll(() => { ${mixedBody} })`, warnings: 0 },
  { name: 'optional namespace hook', source: `import * as wevu from 'wevu'; wevu.onPageScroll?.(() => { ${mixedBody} })`, warnings: 2 },
  { name: 'computed namespace hook', source: `import * as wevu from 'wevu'; wevu['onPageScroll'](() => { ${mixedBody} })`, warnings: 2 },
  { name: 'computed API calls', source: 'onPageScroll(() => { wx["getStorageSync"]("key"); this["setData"]({ top: 1 }) })', warnings: 2 },
  { name: 'optional API calls', source: 'onPageScroll(() => { wx?.getStorageSync?.("key"); this?.setData?.({ top: 1 }) })', warnings: 2 },
  { name: 'encounter order and deduplication', source: 'onPageScroll(() => { wx.getSystemInfoSync(); wx.getStorageSync("key"); wx.getSystemInfoSync() })', warnings: 2 },
  { name: 'nested function exclusion', source: 'onPageScroll(() => { const nested = () => wx.getStorageSync("key") })', warnings: 0 },
  { name: 'nested independent hook', source: 'onPageScroll(() => { onPageScroll(() => { wx.getStorageSync("key") }) })', warnings: 1 },
  { name: 'hook in another argument', source: 'onPageScroll(() => {}, onPageScroll(() => {}))', warnings: 2 },
  { name: 'parenthesized callback and member', source: '(onPageScroll)((() => { (wx).getStorageSync("key") }))', warnings: 1 },
  { name: 'callback default parameter', source: 'onPageScroll((event = wx.getStorageSync("key")) => {})', warnings: 2 },
  { name: 'function default parameter', source: 'onPageScroll(function (event = wx.getStorageSync("key")) {})', warnings: 2 },
  { name: 'Unicode column', source: 'const label = "中文😀"; onPageScroll(() => { wx.getStorageSync("key") })', warnings: 1 },
  ...['\n', '\r\n', '\r', '\u2028', '\u2029'].map(separator => ({
    name: `line separator ${JSON.stringify(separator)}`,
    source: `const label = "中文😀";${separator}onPageScroll(() => { wx.getStorageSync("key") })`,
    warnings: 1,
  })),
]

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('built AST warning parity with the real native binding', () => {
  it.each(cases)('preserves Babel locations and warnings for $name', async ({ source, warnings }) => {
    vi.stubEnv('WEAPP_VITE_NATIVE', '1')
    vi.stubEnv('WEAPP_VITE_NATIVE_AST_PATH', fileURLToPath(new URL('../index.js', import.meta.url)))
    const ast = await import('../../ast/dist/index.mjs')
    const baseline = ast.collectOnPageScrollWarningsWithBabel(source, 'inline.ts')
    const observed = await observeNativeAnalysis(() => {
      ast.analyzeScript(source, { featureFlags: { moduleId: 'wevu', hookToFeature: { onPageScroll: 'scroll' } } })
      return ast.collectOnPageScrollPerformanceWarnings(source, 'inline.ts')
    })

    expect(baseline).toHaveLength(warnings)
    expect(observed.value).toEqual(baseline)
    expect(observed.stats).toMatchObject({ bindingCalls: 1, inputScripts: 1, cacheHits: 1, fallbacks: 0, loadFailures: 0 })
  })
})
