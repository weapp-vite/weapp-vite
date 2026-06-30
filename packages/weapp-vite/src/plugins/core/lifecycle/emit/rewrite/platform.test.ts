import type { OutputBundle, OutputChunk } from 'rolldown'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzeScripts } from '../../../../../ast'
import { getChunkScriptAnalysis, rewriteBundleNpmImportsByPlatform, warmupBundleScriptAnalysis } from './platform'

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
})
