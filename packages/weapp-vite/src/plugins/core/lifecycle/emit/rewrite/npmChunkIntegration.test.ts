import type { OutputBundle, OutputChunk } from 'rolldown'
import type { NativeNpmChunkAnalysis } from '../../../../../ast'
import type { ChunkScriptAnalysisCache } from './platform'
import { Buffer } from 'node:buffer'
import { WEAPP_VITE_INJECTED_API_IDENTIFIER } from '@weapp-core/constants'
import MagicString from 'magic-string'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzeNpmChunksWithNative, analyzeScripts } from '../../../../../ast'
import { parseJsLike } from '../../../../../utils/babel'
import { rewriteBundleNpmImportsToLocalRoots } from './localRoot'
import { getChunkNpmChunkAnalysis, getChunkNpmPlatformApiRanges } from './npmChunkCache'
import { rewriteBundleNpmImportsByPlatform, rewriteBundlePlatformApi, warmupBundleScriptAnalysis } from './platform'

vi.mock('../../../../../ast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../ast')>()
  return {
    ...actual,
    analyzeNpmChunksWithNative: vi.fn(),
    analyzeScripts: vi.fn(actual.analyzeScripts),
  }
})

vi.mock('../../../../../utils/babel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../utils/babel')>()
  return { ...actual, parseJsLike: vi.fn(actual.parseJsLike) }
})

const code = [
  `const emoji = '😀'`,
  `const dep = require('ui-lib/button')`,
  `const wrapped = __toESM(dep, 1)`,
  `wx?.getStorageSync('key')`,
  `const rewriteMarker = wrapped.default`,
].join('\n')

function fixtureAnalysis(source: string): NativeNpmChunkAnalysis {
  const requireStart = source.indexOf('\'ui-lib/button\'')
  const apiStart = source.indexOf('wx?')
  const secondArgumentStart = source.indexOf(', 1') + 2
  return {
    requires: [{ start: requireStart, end: requireStart + '\'ui-lib/button\''.length, importee: 'ui-lib/button' }],
    platformApiRanges: apiStart < 0 ? [] : [{ start: apiStart, end: apiStart + 2 }],
    localRootFacts: [
      { kind: 'alias', bindingName: 'dep', importee: 'ui-lib/button' },
      { kind: 'require', requireIndex: 0, bindingName: 'dep' },
      ...(secondArgumentStart > 1
        ? [{
            kind: 'interop' as const,
            referenceName: 'dep',
            secondArgumentStart,
            secondArgumentEnd: secondArgumentStart + 1,
          }]
        : []),
    ],
  }
}

function createChunk(source: string, mode = 'none'): OutputChunk {
  const chunk = { code: source, fileName: 'pages/index.js', map: null, type: 'chunk' } as OutputChunk
  const map = new MagicString(source).generateMap({ hires: true, includeContent: true, source: 'src/pages/index.ts' })
  if (mode === 'inline') {
    chunk.code += `\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(map.toString()).toString('base64')}`
  }
  else if (mode === 'external') {
    chunk.map = map as any
  }
  return chunk
}

const npmRewriters = {
  localRoot(bundle: OutputBundle, cache: ChunkScriptAnalysisCache) {
    rewriteBundleNpmImportsToLocalRoots(bundle, { 'ui-lib': '1.0.0' }, [], { analysisCache: cache })
  },
  platform(bundle: OutputBundle, cache: ChunkScriptAnalysisCache) {
    rewriteBundleNpmImportsByPlatform('alipay', bundle, { 'ui-lib': '1.0.0' }, undefined, { analysisCache: cache })
  },
}

describe.each(Object.entries(npmRewriters))('%s native chunk summary integration', (_name, rewriteNpm) => {
  beforeEach(() => {
    vi.mocked(analyzeNpmChunksWithNative).mockReset()
    vi.mocked(analyzeScripts).mockClear()
    vi.mocked(parseJsLike).mockClear()
    vi.stubEnv('WEAPP_VITE_NATIVE', '0')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  function run(chunk: OutputChunk, cache: ChunkScriptAnalysisCache) {
    const bundle = { [chunk.fileName]: chunk }
    warmupBundleScriptAnalysis(bundle, { cache })
    rewriteNpm(bundle, cache)
    rewriteBundlePlatformApi(bundle, 'wpi', { analysisCache: cache })
  }

  it.each(['none', 'external', 'inline'])('matches complete JS output and %s map through one batch', (mode) => {
    const expected = createChunk(code, mode)
    run(expected, new WeakMap())
    vi.mocked(parseJsLike).mockClear()
    vi.mocked(analyzeScripts).mockClear()
    vi.mocked(analyzeNpmChunksWithNative).mockClear()
    vi.mocked(analyzeNpmChunksWithNative).mockImplementation(inputs => inputs.map(input => fixtureAnalysis(input.code)))
    const actual = createChunk(code, mode)

    run(actual, new WeakMap())

    expect(actual).toEqual(expected)
    expect(analyzeNpmChunksWithNative).toHaveBeenCalledTimes(1)
    expect(analyzeScripts).not.toHaveBeenCalled()
    expect(parseJsLike).not.toHaveBeenCalled()
  })

  it('falls back once for a null item without reanalyzing its successful neighbor', () => {
    const source = `const dep = require('ui-lib/button')`
    const failed = createChunk(source)
    const successful = createChunk(source)
    successful.fileName = 'pages/second.js'
    const bundle = { [failed.fileName]: failed, [successful.fileName]: successful }
    const cache: ChunkScriptAnalysisCache = new WeakMap()
    vi.mocked(analyzeNpmChunksWithNative).mockReturnValue([null, fixtureAnalysis(source)])

    warmupBundleScriptAnalysis(bundle, { cache })
    rewriteNpm(bundle, cache)
    rewriteBundlePlatformApi(bundle, 'wpi', { analysisCache: cache })

    expect(parseJsLike).toHaveBeenCalledTimes(1)
    expect(analyzeScripts).not.toHaveBeenCalled()
    expect(analyzeNpmChunksWithNative).toHaveBeenCalledTimes(1)
    expect(failed.code).not.toContain('require(\'ui-lib/button\')')
    expect(successful.code).not.toContain('require(\'ui-lib/button\')')
  })

  it('does not reuse consumed npm facts when a caller repeats the npm phase', () => {
    const chunk = createChunk(code)
    const bundle = { [chunk.fileName]: chunk }
    const cache: ChunkScriptAnalysisCache = new WeakMap()
    vi.mocked(analyzeNpmChunksWithNative).mockReturnValue([fixtureAnalysis(code)])
    warmupBundleScriptAnalysis(bundle, { cache })
    rewriteNpm(bundle, cache)
    const before = chunk.code
    expect(getChunkNpmChunkAnalysis(chunk, cache)).toBeUndefined()
    expect(getChunkNpmPlatformApiRanges(chunk, cache)).toBeDefined()

    rewriteNpm(bundle, cache)

    expect(parseJsLike).toHaveBeenCalledTimes(1)
    expect(chunk.code).toBe(before)
    expect(analyzeNpmChunksWithNative).toHaveBeenCalledTimes(1)
  })

  it('discards stale API ranges after another owner changes the source', () => {
    const chunk = createChunk(code)
    const bundle = { [chunk.fileName]: chunk }
    const cache: ChunkScriptAnalysisCache = new WeakMap()
    vi.mocked(analyzeNpmChunksWithNative).mockReturnValueOnce([fixtureAnalysis(code)])
    warmupBundleScriptAnalysis(bundle, { cache })
    rewriteNpm(bundle, cache)
    Object.assign(chunk, { code: `const inserted = 1\n${chunk.code}` })
    expect(getChunkNpmPlatformApiRanges(chunk, cache)).toBeUndefined()
    vi.mocked(analyzeNpmChunksWithNative).mockReturnValueOnce([null])

    rewriteBundlePlatformApi(bundle, 'wpi', { analysisCache: cache })

    expect(chunk.code).toContain(`${WEAPP_VITE_INJECTED_API_IDENTIFIER}?.getStorageSync`)
    expect(parseJsLike).toHaveBeenCalledTimes(1)
  })

  it('uses the original JS rewrite once if native edit consumption fails', () => {
    const source = `const dep = require('ui-lib/button')`
    const expected = createChunk(source)
    run(expected, new WeakMap())
    vi.mocked(parseJsLike).mockClear()
    vi.mocked(analyzeNpmChunksWithNative).mockClear()
    const malformed = fixtureAnalysis(source)
    malformed.requires[0]!.end = source.length + 10
    vi.mocked(analyzeNpmChunksWithNative).mockReturnValue([malformed])
    const actual = createChunk(source)

    run(actual, new WeakMap())

    expect(actual).toEqual(expected)
    expect(parseJsLike).toHaveBeenCalledTimes(1)
    expect(analyzeNpmChunksWithNative).toHaveBeenCalledTimes(1)
  })
})

describe('native API range validation', () => {
  beforeEach(() => vi.stubEnv('WEAPP_VITE_NATIVE', '0'))
  afterEach(() => vi.unstubAllEnvs())

  it('falls back once for a stale range instead of silently skipping a platform rewrite', () => {
    vi.mocked(parseJsLike).mockClear()
    const chunk = createChunk('wx.request()')
    const cache: ChunkScriptAnalysisCache = new WeakMap()
    cache.set(chunk, {
      code: chunk.code,
      analysis: { hasPlatformApiAccess: true, hasStaticRequireLiteral: false },
      npmPlatformApiRanges: [{ start: 3, end: 10 }],
    })

    rewriteBundlePlatformApi({ [chunk.fileName]: chunk }, 'wpi', { analysisCache: cache })

    expect(chunk.code).toContain(`${WEAPP_VITE_INJECTED_API_IDENTIFIER}.request()`)
    expect(parseJsLike).toHaveBeenCalledTimes(1)
  })
})

describe('local root legacy interop boundary', () => {
  beforeEach(() => vi.stubEnv('WEAPP_VITE_NATIVE', '0'))
  afterEach(() => vi.unstubAllEnvs())

  it('preserves interop cleanup around an already relative require even when require is shadowed', () => {
    const source = `function local(require) { return __toESM(require('./miniprogram_npm/ui-lib/button'), 1) }`
    const expected = createChunk(source)
    vi.mocked(analyzeNpmChunksWithNative).mockReset()
    const rewrite = (chunk: OutputChunk, cache: ChunkScriptAnalysisCache) => {
      const bundle = { [chunk.fileName]: chunk }
      warmupBundleScriptAnalysis(bundle, { cache })
      rewriteBundleNpmImportsToLocalRoots(bundle, { 'ui-lib': '1.0.0' }, [], { analysisCache: cache })
    }
    rewrite(expected, new WeakMap())
    const start = source.indexOf(', 1') + 2
    vi.mocked(analyzeNpmChunksWithNative).mockReturnValue([{
      requires: [],
      platformApiRanges: [],
      localRootFacts: [{
        kind: 'interop',
        importee: './miniprogram_npm/ui-lib/button',
        secondArgumentStart: start,
        secondArgumentEnd: start + 1,
      }],
    }])
    vi.mocked(parseJsLike).mockClear()
    const actual = createChunk(source)

    rewrite(actual, new WeakMap())

    expect(actual).toEqual(expected)
    expect(actual.code).not.toContain(', 1')
    expect(parseJsLike).not.toHaveBeenCalled()
  })
})
