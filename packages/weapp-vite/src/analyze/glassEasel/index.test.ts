import type { OutputBundle } from 'rolldown'
import { describe, expect, it } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import { scanWxml } from '../../wxml'
import { analyzeGlassEaselBundle, createGlassEaselAnalyzeResult } from './index'

function createContext() {
  const runtimeState = createRuntimeState()
  runtimeState.glassEasel.silent = true
  return {
    runtimeState,
    configService: {
      platform: 'weapp',
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
})
