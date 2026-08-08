import type { OutputBundle, OutputChunk } from 'rolldown'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import MagicString from 'magic-string'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzeScripts } from '../../../../../ast'
import {
  getChunkScriptAnalysis,
  rewriteBundleDynamicGlobalResolution,
  rewriteBundleNpmImportsByPlatform,
  rewriteBundlePlatformApi,
  warmupBundleScriptAnalysis,
} from './platform'

vi.mock('../../../../../ast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../ast')>()
  return {
    ...actual,
    analyzeScript: vi.fn(),
    analyzeScripts: vi.fn((inputs: Array<{ code: string }>) => {
      return inputs.map(input => ({
        featureFlags: new Set(),
        hasPlatformApiAccess: input.code.includes('wx.'),
        hasStaticRequireLiteral: input.code.includes('require('),
      }))
    }),
  }
})

function createChunk(fileName: string, code: string): OutputChunk {
  return {
    code,
    dynamicImports: [],
    exports: [],
    facadeModuleId: null,
    fileName,
    imports: [],
    isDynamicEntry: false,
    isEntry: false,
    isImplicitEntry: false,
    map: null,
    moduleIds: [],
    modules: {},
    name: fileName,
    preliminaryFileName: fileName,
    sourcemapFileName: null,
    type: 'chunk',
  } as unknown as OutputChunk
}

function attachIdentitySourceMap(chunk: OutputChunk, source: string) {
  chunk.map = new MagicString(chunk.code).generateMap({
    hires: true,
    includeContent: true,
    source,
  }) as any
}

function expectMarkerMappedToSource(
  chunk: OutputChunk,
  source: string,
  sourceCode: string,
  marker: string,
) {
  const generatedIndex = chunk.code.indexOf(marker)
  const sourceIndex = sourceCode.indexOf(marker)
  expect(generatedIndex).toBeGreaterThanOrEqual(0)
  expect(sourceIndex).toBeGreaterThanOrEqual(0)
  expect(chunk.map).toBeTruthy()

  const generatedPrefix = chunk.code.slice(0, generatedIndex)
  const sourcePrefix = sourceCode.slice(0, sourceIndex)
  const original = originalPositionFor(new TraceMap(chunk.map as any), {
    column: generatedPrefix.length - generatedPrefix.lastIndexOf('\n') - 1,
    line: generatedPrefix.split('\n').length,
  })

  expect(original.source).toBe(source)
  expect(original.line).toBe(sourcePrefix.split('\n').length)
  expect(original.column).toBe(sourcePrefix.length - sourcePrefix.lastIndexOf('\n') - 1)
}

describe('bundle script analysis warmup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('preloads chunk analysis in one batch and reuses the cache', () => {
    const cache = new WeakMap<OutputChunk, {
      analysis: {
        hasPlatformApiAccess: boolean
        hasStaticRequireLiteral: boolean
      }
      code: string
    }>()
    const first = createChunk('pages/index.js', `const dep = require('./dep')`)
    const second = createChunk('pages/about.js', `wx.getStorageSync('k')`)
    const plain = createChunk('pages/plain.js', `console.log('plain')`)
    const bundle: OutputBundle = {
      [first.fileName]: first,
      [second.fileName]: second,
      [plain.fileName]: plain,
    }

    warmupBundleScriptAnalysis(bundle, {
      astEngine: 'oxc',
      cache,
    })

    expect(analyzeScripts).toHaveBeenCalledTimes(1)
    expect(analyzeScripts).toHaveBeenCalledWith([
      {
        code: first.code,
        filename: first.fileName,
      },
      {
        code: second.code,
        filename: second.fileName,
      },
    ], { engine: 'oxc' })
    expect(getChunkScriptAnalysis(first, { astEngine: 'oxc', cache })).toMatchObject({
      hasPlatformApiAccess: false,
      hasStaticRequireLiteral: true,
    })
    expect(getChunkScriptAnalysis(second, { astEngine: 'oxc', cache })).toMatchObject({
      hasPlatformApiAccess: true,
      hasStaticRequireLiteral: false,
    })
    expect(getChunkScriptAnalysis(plain, { astEngine: 'oxc', cache })).toMatchObject({
      hasPlatformApiAccess: false,
      hasStaticRequireLiteral: false,
    })
    expect(analyzeScripts).toHaveBeenCalledTimes(1)
  })

  it('uses warmup before bundle npm import rewriting', () => {
    const chunk = createChunk('pages/index.js', `const dep = require('pkg')`)
    const bundle: OutputBundle = {
      [chunk.fileName]: chunk,
    }

    rewriteBundleNpmImportsByPlatform('alipay', bundle, {
      pkg: '1.0.0',
    }, undefined, {
      astEngine: 'oxc',
      analysisCache: new WeakMap(),
    })

    expect(analyzeScripts).toHaveBeenCalledTimes(1)
    expect(chunk.code).toContain('/node_modules/pkg')
  })

  it('keeps sourcemaps aligned after platform npm import rewriting', () => {
    const source = 'src/pages/index.ts'
    const code = `const dep = require('pkg'); const issue769PlatformNpmMarker = dep`
    const chunk = createChunk('pages/index.js', code)
    attachIdentitySourceMap(chunk, source)
    const bundle: OutputBundle = {
      [chunk.fileName]: chunk,
    }

    rewriteBundleNpmImportsByPlatform('alipay', bundle, {
      pkg: '1.0.0',
    })

    expect(chunk.code).toContain('/node_modules/pkg')
    expectMarkerMappedToSource(chunk, source, code, 'issue769PlatformNpmMarker')
  })

  it('keeps analysis cache valid after npm import rewriting', () => {
    const cache = new WeakMap<OutputChunk, {
      analysis: {
        hasPlatformApiAccess: boolean
        hasStaticRequireLiteral: boolean
      }
      code: string
    }>()
    const chunk = createChunk('pages/index.js', [
      `const dep = require('pkg')`,
      `wx.getStorageSync('k')`,
    ].join('\n'))
    const bundle: OutputBundle = {
      [chunk.fileName]: chunk,
    }

    rewriteBundleNpmImportsByPlatform('alipay', bundle, {
      pkg: '1.0.0',
    }, undefined, {
      astEngine: 'oxc',
      analysisCache: cache,
    })
    rewriteBundlePlatformApi(bundle, 'my', {
      astEngine: 'oxc',
      analysisCache: cache,
    })

    expect(analyzeScripts).toHaveBeenCalledTimes(1)
    expect(chunk.code).toContain('/node_modules/pkg')
    expect(chunk.code).toContain('__weappViteInjectedApi__.getStorageSync')
  })

  it('reuses the same warmup cache across npm and platform api rewrites', () => {
    const cache = new WeakMap<OutputChunk, {
      analysis: {
        hasPlatformApiAccess: boolean
        hasStaticRequireLiteral: boolean
      }
      code: string
    }>()
    const chunk = createChunk('pages/index.js', [
      `const dep = require('pkg')`,
      `wx.getStorageSync('k')`,
    ].join('\n'))
    const bundle: OutputBundle = {
      [chunk.fileName]: chunk,
    }

    warmupBundleScriptAnalysis(bundle, {
      astEngine: 'oxc',
      cache,
    })
    rewriteBundleNpmImportsByPlatform('alipay', bundle, {
      pkg: '1.0.0',
    }, undefined, {
      astEngine: 'oxc',
      analysisCache: cache,
    })
    rewriteBundlePlatformApi(bundle, 'my', {
      astEngine: 'oxc',
      analysisCache: cache,
    })

    expect(analyzeScripts).toHaveBeenCalledTimes(1)
    expect(chunk.code).toContain('/node_modules/pkg')
    expect(chunk.code).toContain('__weappViteInjectedApi__.getStorageSync')
  })

  it('rewrites dynamic global resolution only for matching chunks', () => {
    const plain = createChunk('pages/plain.js', `const value = globalThis`)
    const setupFunction = createChunk('pages/setup.js', `function runSetupFunction(setup) { return setup() }`)
    const functionGlobal = createChunk('pages/function.js', `const root = Function("return this")()`)
    const browserTernary = createChunk('pages/browser.js', `const root = typeof self<"u"?self:typeof window<"u"?window:globalThis`)
    const bundle: OutputBundle = {
      [plain.fileName]: plain,
      [setupFunction.fileName]: setupFunction,
      [functionGlobal.fileName]: functionGlobal,
      [browserTernary.fileName]: browserTernary,
    }

    rewriteBundleDynamicGlobalResolution(bundle)

    expect(plain.code).toBe(`const value = globalThis`)
    expect(setupFunction.code).toBe(`function runSetupFunction(setup) { return setup() }`)
    expect(functionGlobal.code).toBe(`const root = globalThis`)
    expect(browserTernary.code).toBe(`const root = globalThis`)
  })

  it('keeps sourcemaps aligned after platform api and dynamic global rewrites', () => {
    const platformSource = 'src/pages/platform.ts'
    const platformCode = [
      `wx.getStorageSync('key')`,
      `const issue769PlatformApiMarker = true`,
    ].join('\n')
    const platformChunk = createChunk('pages/platform.js', platformCode)
    attachIdentitySourceMap(platformChunk, platformSource)

    rewriteBundlePlatformApi({ [platformChunk.fileName]: platformChunk }, 'wpi')

    expect(platformChunk.code).toContain('__weappViteInjectedApi__.getStorageSync')
    expectMarkerMappedToSource(platformChunk, platformSource, platformCode, 'issue769PlatformApiMarker')

    const globalSource = 'src/pages/global.ts'
    const globalCode = `const root = Function("return this")(); const issue769GlobalMarker = root`
    const globalChunk = createChunk('pages/global.js', globalCode)
    attachIdentitySourceMap(globalChunk, globalSource)

    rewriteBundleDynamicGlobalResolution({ [globalChunk.fileName]: globalChunk })

    expect(globalChunk.code).toContain('const root = globalThis')
    expectMarkerMappedToSource(globalChunk, globalSource, globalCode, 'issue769GlobalMarker')
  })
})
