import type { OutputBundle } from 'rolldown'
import { describe, expect, it, vi } from 'vitest'
import logger from '../../logger'
import { createRuntimeState } from '../../runtime/runtimeState'
import { scanWxml } from '../../wxml'
import { analyzeGlassEaselBundle, createGlassEaselAnalyzeResult, invalidateGlassEaselSource } from './index'

function createContext() {
  const runtimeState = createRuntimeState()
  runtimeState.glassEasel.silent = true
  return {
    runtimeState,
    configService: {
      platform: 'weapp',
      outputExtensions: { wxml: 'wxml' },
      relativeOutputPath: (file: string) => file.replace('/project/src/', ''),
      relativeAbsoluteSrcRoot: (file: string) => file.replace('/project/src/', ''),
    },
  } as any
}

describe('glass-easel analyze', () => {
  it('reports an incomplete explicit opt-in, template, escaping, and selector diagnostics', () => {
    const ctx = createContext()
    const bundle = {
      'app.json': {
        type: 'asset',
        fileName: 'app.json',
        source: '{"pages":["pages/index/index"],"glassEaselWebview":true}',
      },
      'pages/index/index.wxml': {
        type: 'asset',
        fileName: 'pages/index/index.wxml',
        source: String.raw`<block wx-for="{{list}}"><include src="./item.wxml" /><view title="\"legacy\"" /></block>`,
      },
      'pages/index/index.js': {
        type: 'chunk',
        fileName: 'pages/index/index.js',
        code: `wx.createSelectorQuery().in(this).select('#1-item').exec()`,
      },
    } as unknown as OutputBundle

    analyzeGlassEaselBundle(ctx, bundle)
    const result = createGlassEaselAnalyzeResult(ctx)

    expect(result.detected).toBe(true)
    expect(result.minimumBaseLibrary).toBe('3.8.12')
    expect(result.diagnostics.map(item => item.code)).toEqual([
      'GE001',
      'GE005',
      'GE006',
      'GE002',
      'GE003',
      'GE004',
      'GE004',
    ])
    expect(result.summary).toEqual({ errors: 5, warnings: 2 })
  })

  it('keeps componentFramework-only projects on the fallback path', () => {
    const ctx = createContext()
    analyzeGlassEaselBundle(ctx, {
      'app.json': {
        type: 'asset',
        fileName: 'app.json',
        source: '{"componentFramework":"glass-easel"}',
      },
      'pages/index/index.wxml': {
        type: 'asset',
        fileName: 'pages/index/index.wxml',
        source: '<view wx-if="{{ready}}" />',
      },
    } as unknown as OutputBundle)

    expect(createGlassEaselAnalyzeResult(ctx)).toMatchObject({
      detected: false,
      diagnostics: [],
    })
  })

  it('keeps valid paired config free from GE001', () => {
    const ctx = createContext()
    analyzeGlassEaselBundle(ctx, {
      'plugin.json': {
        type: 'asset',
        fileName: 'plugin.json',
        source: '{"componentFramework":"glass-easel","glassEaselWebview":true}',
      },
    } as unknown as OutputBundle)

    expect(createGlassEaselAnalyzeResult(ctx)).toMatchObject({
      detected: true,
      diagnostics: [],
    })
  })

  it('keeps GE002 visible after the emitted template has been normalized', () => {
    const ctx = createContext()
    ctx.runtimeState.wxml.tokenMap.set(
      '/project/src/pages/index/index.wxml',
      scanWxml('<view wx-if="{{ready}}" />'),
    )
    analyzeGlassEaselBundle(ctx, {
      'app.json': {
        type: 'asset',
        fileName: 'app.json',
        source: '{"componentFramework":"glass-easel","glassEaselWebview":true}',
      },
      'pages/index/index.wxml': {
        type: 'asset',
        fileName: 'pages/index/index.wxml',
        source: '<view wx:if="{{ready}}" />',
      },
    } as unknown as OutputBundle)

    expect(createGlassEaselAnalyzeResult(ctx).diagnostics).toContainEqual(expect.objectContaining({
      code: 'GE002',
      file: 'pages/index/index.wxml',
      normalized: true,
    }))
  })

  it('replaces GE001 with the latest analysis of the same output', () => {
    const bad = {
      'app.json': {
        type: 'asset',
        fileName: 'app.json',
        source: '{"glassEaselWebview":true}',
      },
    } as unknown as OutputBundle
    const fixed = {
      'app.json': {
        type: 'asset',
        fileName: 'app.json',
        source: '{"glassEaselWebview":true,"componentFramework":"glass-easel"}',
      },
    } as unknown as OutputBundle
    const reused = createContext()
    analyzeGlassEaselBundle(reused, bad)
    expect(createGlassEaselAnalyzeResult(reused).diagnostics.map(item => item.code)).toEqual(['GE001'])

    analyzeGlassEaselBundle(reused, fixed)
    const fresh = createContext()
    analyzeGlassEaselBundle(fresh, fixed)
    expect(createGlassEaselAnalyzeResult(reused)).toEqual(createGlassEaselAnalyzeResult(fresh))
  })

  it('replaces covered template and script diagnostics while retaining uncovered files', () => {
    const ctx = createContext()
    analyzeGlassEaselBundle(ctx, {
      'app.json': {
        type: 'asset',
        fileName: 'app.json',
        source: '{"glassEaselWebview":true,"componentFramework":"glass-easel"}',
      },
      'pages/a/index.wxml': {
        type: 'asset',
        fileName: 'pages/a/index.wxml',
        source: '<block wx:for="{{list}}">\n<include src="./item.wxml" /></block>',
      },
      'pages/b/index.js': {
        type: 'chunk',
        fileName: 'pages/b/index.js',
        code: `wx.createSelectorQuery().select('#1-old').exec()`,
      },
    } as unknown as OutputBundle, { mode: 'full', outputScope: 'main' })

    analyzeGlassEaselBundle(ctx, {
      'pages/a/index.wxml': {
        type: 'asset',
        fileName: 'pages/a/index.wxml',
        source: '<view />',
      },
    } as unknown as OutputBundle, { mode: 'partial', outputScope: 'main' })
    expect(createGlassEaselAnalyzeResult(ctx).diagnostics.map(item => item.code)).toEqual(['GE005'])

    analyzeGlassEaselBundle(ctx, {
      'pages/b/index.js': {
        type: 'chunk',
        fileName: 'pages/b/index.js',
        code: `\nwx.createSelectorQuery().select('.2-next').exec()`,
      },
    } as unknown as OutputBundle, { mode: 'partial', outputScope: 'main' })
    expect(createGlassEaselAnalyzeResult(ctx).diagnostics).toEqual([
      expect.objectContaining({
        code: 'GE005',
        file: 'pages/b/index.js',
        line: 2,
        message: expect.stringContaining('.2-next'),
      }),
    ])
  })

  it.each(['partial', 'full'] as const)('revokes a replaced chunk when %s output becomes a non-analyzable asset', (mode) => {
    const ctx = createContext()
    const app = {
      type: 'asset',
      fileName: 'app.json',
      source: '{"glassEaselWebview":true,"componentFramework":"glass-easel"}',
    }
    analyzeGlassEaselBundle(ctx, {
      'app.json': app,
      'pages/replaced/index.js': {
        type: 'chunk',
        fileName: 'pages/replaced/index.js',
        code: 'wx.createSelectorQuery().select("#1-old").exec()',
      },
    } as unknown as OutputBundle, { mode: 'full', outputScope: 'main' })
    expect(createGlassEaselAnalyzeResult(ctx).diagnostics.map(item => item.code)).toEqual(['GE005'])

    analyzeGlassEaselBundle(ctx, {
      'app.json': app,
      'pages/replaced/index.js': {
        type: 'asset',
        fileName: 'pages/replaced/index.js',
        source: 'export const ready = true',
      },
    } as unknown as OutputBundle, { mode, outputScope: 'main' })
    expect(createGlassEaselAnalyzeResult(ctx)).toMatchObject({
      detected: true,
      diagnostics: [],
    })
  })

  it('invalidates source-token and emitted-output facts together across a Vue template rename', () => {
    const ctx = createContext()
    const oldSource = '/project/src/pages/old/index.vue'
    ctx.runtimeState.wxml.tokenMap.set(oldSource, scanWxml('<view wx-if="{{ready}}" />'))
    analyzeGlassEaselBundle(ctx, {
      'app.json': {
        type: 'asset',
        fileName: 'app.json',
        source: '{"glassEaselWebview":true,"componentFramework":"glass-easel"}',
      },
      'pages/old/index.wxml': {
        type: 'asset',
        fileName: 'pages/old/index.wxml',
        source: '<block wx:for="{{list}}"><include src="./item.wxml" /></block>',
      },
      'pages/old/index.js': {
        type: 'chunk',
        fileName: 'pages/old/index.js',
        facadeModuleId: oldSource,
        moduleIds: [oldSource],
        code: `wx.createSelectorQuery().select('#1-old').exec()`,
      },
    } as unknown as OutputBundle, { mode: 'full', outputScope: 'main' })
    expect(createGlassEaselAnalyzeResult(ctx).diagnostics.map(item => item.code)).toEqual([
      'GE005',
      'GE002',
      'GE003',
    ])

    ctx.runtimeState.wxml.tokenMap.delete(oldSource)
    invalidateGlassEaselSource(ctx, oldSource)
    const newSource = '/project/src/pages/new/index.vue'
    analyzeGlassEaselBundle(ctx, {
      'pages/new/index.js': {
        type: 'chunk',
        fileName: 'pages/new/index.js',
        facadeModuleId: newSource,
        moduleIds: [newSource],
        code: `wx.createSelectorQuery().select('#2-new').exec()`,
      },
    } as unknown as OutputBundle, { mode: 'partial', outputScope: 'main' })

    expect(createGlassEaselAnalyzeResult(ctx).diagnostics).toEqual([
      expect.objectContaining({
        code: 'GE005',
        file: 'pages/new/index.js',
        message: expect.stringContaining('#2-new'),
      }),
    ])
  })

  it('reconciles only the exact full-build scope', () => {
    const ctx = createContext()
    analyzeGlassEaselBundle(ctx, {
      'app.json': {
        type: 'asset',
        fileName: 'app.json',
        source: '{"glassEaselWebview":true,"componentFramework":"glass-easel"}',
      },
      'pages/main/index.js': {
        type: 'chunk',
        fileName: 'pages/main/index.js',
        code: `wx.createSelectorQuery().select('#1-main').exec()`,
      },
    } as unknown as OutputBundle, { mode: 'full', outputScope: 'main' })
    analyzeGlassEaselBundle(ctx, {
      'pkg/pages/child/index.js': {
        type: 'chunk',
        fileName: 'pkg/pages/child/index.js',
        code: `wx.createSelectorQuery().select('#2-child').exec()`,
      },
    } as unknown as OutputBundle, { mode: 'full', outputScope: 'independent:pkg' })

    analyzeGlassEaselBundle(ctx, {
      'app.json': {
        type: 'asset',
        fileName: 'app.json',
        source: '{"glassEaselWebview":true,"componentFramework":"glass-easel"}',
      },
    } as unknown as OutputBundle, { mode: 'full', outputScope: 'main' })
    expect(createGlassEaselAnalyzeResult(ctx).diagnostics).toEqual([
      expect.objectContaining({ file: 'pkg/pages/child/index.js' }),
    ])
  })

  it('keeps warning deduplication independent from current diagnostics', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const ctx = createContext()
    ctx.runtimeState.glassEasel.silent = false
    const analyzeApp = (source: string) => analyzeGlassEaselBundle(ctx, {
      'app.json': { type: 'asset', fileName: 'app.json', source },
    } as unknown as OutputBundle)

    analyzeApp('{"glassEaselWebview":true}')
    analyzeApp('{"glassEaselWebview":true,"componentFramework":"glass-easel"}')
    expect(createGlassEaselAnalyzeResult(ctx).diagnostics).toEqual([])
    analyzeApp('{"glassEaselWebview":true}')

    expect(warn).toHaveBeenCalledTimes(1)
    expect(ctx.runtimeState.glassEasel.warnedDiagnostics.size).toBe(1)
    expect(createGlassEaselAnalyzeResult(ctx).diagnostics.map(item => item.code)).toEqual(['GE001'])
    warn.mockRestore()
  })
})
