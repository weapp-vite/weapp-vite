import type { OutputBundle } from 'rolldown'
import type { CompilerContext } from '../../context'
import { describe, expect, it } from 'vitest'
import { createRuntimeState } from '../../runtime/runtimeState'
import { analyzeGlassEaselBundle, createGlassEaselAnalyzeResult, invalidateGlassEaselSource } from './index'
import { refreshGlassEaselNativeScripts } from './nativeScripts'

function createContext(): CompilerContext {
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
  } as unknown as CompilerContext
}

function enableGlassEasel(ctx: CompilerContext, scripts: Record<string, { code: string, moduleIds: string[] }> = {}): void {
  const bundle: Record<string, unknown> = {
    'app.json': {
      type: 'asset',
      fileName: 'app.json',
      source: '{"glassEaselWebview":true,"componentFramework":"glass-easel"}',
    },
  }
  for (const [file, script] of Object.entries(scripts)) {
    bundle[file] = {
      type: 'chunk',
      fileName: file,
      code: script.code,
      moduleIds: script.moduleIds,
    }
  }
  analyzeGlassEaselBundle(ctx, bundle as unknown as OutputBundle, { mode: 'full', outputScope: 'main' })
}

describe('GlassEasel native script facts', () => {
  it('replaces one affected chunk from all current modules without clearing sibling chunks', () => {
    const ctx = createContext()
    const first = '/project/src/first.ts'
    const sibling = '/project/src/sibling.ts'
    const other = '/project/src/other.ts'
    enableGlassEasel(ctx, {
      'pages/first.js': {
        code: [
          'wx.createSelectorQuery().select("#1-first").exec()',
          'wx.createSelectorQuery().select("#2-sibling").exec()',
        ].join('\n'),
        moduleIds: [first, sibling],
      },
      'pages/other.js': {
        code: 'wx.createSelectorQuery().select("#3-other").exec()',
        moduleIds: [other],
      },
    })

    refreshGlassEaselNativeScripts(ctx, [{
      file: 'pages/first.js',
      modules: [
        { id: first, code: 'export const fixed = true' },
        { id: sibling, code: 'wx.createSelectorQuery().select("#2-sibling").exec()' },
      ],
    }])

    const diagnostics = createGlassEaselAnalyzeResult(ctx).diagnostics
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: 'GE005',
        file: 'pages/first.js',
        message: expect.stringContaining('#2-sibling'),
      }),
      expect.objectContaining({
        code: 'GE005',
        file: 'pages/other.js',
        message: expect.stringContaining('#3-other'),
      }),
    ])
    expect(diagnostics[0]).not.toHaveProperty('line')
    expect(diagnostics[0]).not.toHaveProperty('column')

    invalidateGlassEaselSource(ctx, first)
    expect(createGlassEaselAnalyzeResult(ctx).diagnostics).toEqual([
      expect.objectContaining({ file: 'pages/other.js' }),
    ])
  })

  it('keeps an unmapped module under its source identity and removes that fact once a real chunk owns it', () => {
    const ctx = createContext()
    const sourceId = '/project/src/new.ts?type=script'
    enableGlassEasel(ctx)

    refreshGlassEaselNativeScripts(ctx, [{
      file: sourceId,
      modules: [{ id: sourceId, code: 'wx.createSelectorQuery().select("#4-source").exec()' }],
      sourceOnly: true,
    }])

    expect(createGlassEaselAnalyzeResult(ctx).diagnostics).toEqual([
      expect.objectContaining({
        code: 'GE005',
        file: sourceId,
        message: expect.stringContaining('#4-source'),
      }),
    ])
    expect(createGlassEaselAnalyzeResult(ctx).diagnostics[0]).not.toHaveProperty('line')

    refreshGlassEaselNativeScripts(ctx, [{
      file: 'pages/new.js',
      modules: [{ id: sourceId, code: 'wx.createSelectorQuery().select("#5-output").exec()' }],
    }])

    const diagnostics = createGlassEaselAnalyzeResult(ctx).diagnostics
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: 'GE005',
        file: 'pages/new.js',
        message: expect.stringContaining('#5-output'),
      }),
    ])
    expect(diagnostics[0]).not.toHaveProperty('line')
    expect(diagnostics[0]).not.toHaveProperty('column')
    invalidateGlassEaselSource(ctx, '/project/src/new.ts')
    expect(createGlassEaselAnalyzeResult(ctx).diagnostics).toEqual([])
  })
})
