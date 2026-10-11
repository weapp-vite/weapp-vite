import { describe, expect, it } from 'vitest'
import {
  analyzeCompilerScriptsNative,
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
  it('returns one compact compiler summary per source while sharing duplicate parses', () => {
    const code = `import type { Model } from './model'
import DefaultCard, { Card as LocalCard } from './card'
import * as helpers from './helpers'
import { onLoad } from 'wevu'
defineOptions({ name: 'CardView' })
defineComponentJson({ component: true })
onLoad(() => wx.request())
require('./dependency')
export default {}`
    const [first, second] = analyzeCompilerScriptsNative([
      {
        code,
        filename: 'components/card.ts',
        moduleId: 'wevu',
        hookToFeatureJson: JSON.stringify({ onLoad: 'load' }),
      },
      {
        code,
        filename: 'components/card.ts',
        moduleId: 'wevu',
        hookToFeatureJson: JSON.stringify({ onLoad: 'alternate' }),
      },
    ])

    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    if (!first || !second) {
      throw new Error('compiler summaries must be present')
    }
    expect(first.imports).toEqual(second.imports)
    expect(first.hasDefaultExport).toBe(second.hasDefaultExport)
    expect(first.defineOptionsName).toBe(second.defineOptionsName)
    expect(first.isMiniProgramComponent).toBe(second.isMiniProgramComponent)
    expect(first).toMatchObject({
      hasDefaultExport: true,
      defineOptionsName: 'CardView',
      isMiniProgramComponent: true,
      hasStaticRequireLiteral: true,
      hasPlatformApiAccess: true,
    })
    expect(first.featureFlags).toEqual(['load'])
    expect(second.featureFlags).toEqual(['alternate'])
    expect(first.imports).toEqual([
      { local: 'Model', imported: 'Model', source: './model', kind: 'named', typeOnly: true },
      { local: 'DefaultCard', imported: 'default', source: './card', kind: 'default', typeOnly: false },
      { local: 'LocalCard', imported: 'Card', source: './card', kind: 'named', typeOnly: false },
      { local: 'helpers', imported: undefined, source: './helpers', kind: 'namespace', typeOnly: false },
      { local: 'onLoad', imported: 'onLoad', source: 'wevu', kind: 'named', typeOnly: false },
    ])
  })

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
