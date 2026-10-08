import { describe, expect, it } from 'vitest'
import {
  analyzeScriptNative,
  analyzeScriptsNative,
  collectFeatureFlagsNative,
  collectOnPageScrollDiagnosticsNative,
  mayContainPlatformApiAccessNative,
  mayContainStaticRequireLiteralNative,
} from '../index.js'

const featureMapping = JSON.stringify({ onPageScroll: 'scroll', onLoad: 'load' })
const source = `import { onPageScroll as scroll, onLoad } from 'wevu'
const dependency = require('./dependency')
scroll(() => {
  this.setData({ top: 1 })
  wx.getStorageSync('key')
  const nested = () => wx.getSystemInfoSync()
})
onLoad(() => {})`

describe('native combined script analysis', () => {
  it('returns diagnostics and existing analysis from the same parsed source', () => {
    const analysis = analyzeScriptNative(source, 'wevu', featureMapping, 'page.ts')

    expect(analysis).toEqual({
      featureFlags: ['load', 'scroll'],
      hasPlatformApiAccess: true,
      hasStaticRequireLiteral: true,
      onPageScrollDiagnostics: collectOnPageScrollDiagnosticsNative(source, 'page.ts'),
    })
    expect(analysis.onPageScrollDiagnostics?.map(diagnostic => diagnostic.kind)).toEqual(['setData', 'syncApi'])
    expect(analysis.onPageScrollDiagnostics?.some(diagnostic => diagnostic.syncApi === 'wx.getSystemInfoSync')).toBe(false)
  })

  it.each([
    'onPageScroll(() => {})',
    'const page = { onPageScroll() { wx.getStorageSync("k") } }',
    'const page = { onPageScroll: () => this.setData({ top: 1 }) }',
    'import * as wevu from "wevu"; wevu.onPageScroll?.(() => {})',
    'onPageScroll(() => () => wx.getStorageSync("nested"))',
  ])('preserves standalone diagnostic semantics for %s', (code) => {
    expect(analyzeScriptNative(code).onPageScrollDiagnostics).toEqual(collectOnPageScrollDiagnosticsNative(code))
  })

  it('returns diagnostics for scroll-only inputs and omits them when the hook is absent', () => {
    const results = analyzeScriptsNative([
      { code: 'onPageScroll(() => {})', filename: 'page.ts' },
      { code: 'require("dep"); wx.request()', filename: 'plain.ts' },
      { code: 'const value = 1', filename: 'unused.ts' },
    ])

    expect(results[0].onPageScrollDiagnostics).toHaveLength(1)
    expect(results[1].onPageScrollDiagnostics).toBeUndefined()
    expect(results[2].onPageScrollDiagnostics).toBeUndefined()
    expect(results[1].hasStaticRequireLiteral).toBe(true)
    expect(results[1].hasPlatformApiAccess).toBe(true)
  })

  it('uses the requested parser language for batch inputs', () => {
    const code = 'const element = <view />; onPageScroll(() => {})'
    expect(analyzeScriptsNative([{ code, filename: 'page.tsx' }])[0].onPageScrollDiagnostics).toHaveLength(1)
    expect(() => analyzeScriptsNative([{ code, filename: 'page.ts' }])).toThrow('Native AST parsing failed')
  })

  it.each([
    `${source}\nconst =`,
    `${source}\nconst value = 1 const other = 2`,
  ])('signals parsing failure consistently instead of returning empty success', (code) => {
    const operations = [
      () => analyzeScriptNative(code, 'wevu', featureMapping),
      () => analyzeScriptsNative([{ code, moduleId: 'wevu', hookToFeatureJson: featureMapping }]),
      () => collectOnPageScrollDiagnosticsNative(code),
      () => collectFeatureFlagsNative(code, 'wevu', featureMapping),
      () => mayContainPlatformApiAccessNative(code),
      () => mayContainStaticRequireLiteralNative(code),
    ]

    for (const operation of operations) {
      expect(operation).toThrow('Native AST parsing failed')
    }
  })
})
