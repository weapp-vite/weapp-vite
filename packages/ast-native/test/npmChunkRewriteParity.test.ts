import type { NativeNpmChunkAnalysis } from '@weapp-vite/ast'
import type { OutputBundle, OutputChunk } from 'rolldown'
import type { ChunkScriptAnalysisCache } from '../../weapp-vite/src/plugins/core/lifecycle/emit/rewrite/platform'
import { Buffer } from 'node:buffer'
import { fileURLToPath } from 'node:url'
import { WEAPP_VITE_INJECTED_API_IDENTIFIER } from '@weapp-core/constants'
import { analyzeNpmChunksWithNative } from '@weapp-vite/ast'
import MagicString from 'magic-string'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { rewriteBundleNpmImportsToLocalRoots } from '../../weapp-vite/src/plugins/core/lifecycle/emit/rewrite/localRoot'
import { getChunkNpmChunkAnalysis, getChunkNpmPlatformApiRanges } from '../../weapp-vite/src/plugins/core/lifecycle/emit/rewrite/npmChunkCache'
import { rewriteBundleNpmImportsByPlatform, rewriteBundlePlatformApi, warmupBundleScriptAnalysis } from '../../weapp-vite/src/plugins/core/lifecycle/emit/rewrite/platform'
import { analyzeNpmChunksNative } from '../index.js'

const fixtures = [
  {
    fileName: 'pages/index.js',
    source: 'src/pages/index.ts',
    code: [
      `const text = '中é😀'; /* wx.request() */`,
      `const dep = require('ui-lib/button')`,
      'const card = require(`ui-lib/card`)',
      `const wrapped = __toESM(dep, 1)`,
      `const alias = dep; helper.__toESM(alias, 1)`,
      `const nested = __toESM(require('ui-lib/nested'), 1)`,
      `const relative = __toESM(require('./miniprogram_npm/ui-lib/ready'), 1)`,
      `function shadow(require, wx) { require('ui-lib/local'); return wx.request() }`,
      `wx?.getStorageSync('key'); my['alert'](); tt.value = 1`,
      `const parityMarker = [wrapped, card, nested, relative]`,
    ].join('\n'),
  },
  {
    fileName: 'subpkg/pages/detail.js',
    source: 'src/subpkg/pages/detail.ts',
    code: [
      `function local(require) { return __toESM(require('./miniprogram_npm/ui-lib/button'), 1) }`,
      `wx.request(); const parityMarker = local`,
    ].join('\n'),
  },
]

function createBundle(mode: string) {
  const bundle: OutputBundle = {}
  for (const fixture of fixtures) {
    const chunk = { code: fixture.code, fileName: fixture.fileName, map: null, type: 'chunk' } as OutputChunk
    const map = new MagicString(fixture.code).generateMap({ hires: true, includeContent: true, source: fixture.source })
    if (mode === 'inline') {
      chunk.code += `\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(map.toString()).toString('base64')}`
    }
    else if (mode === 'external') {
      chunk.map = map as any
    }
    bundle[chunk.fileName] = chunk
  }
  return bundle
}

const npmRewriters = {
  localRoot(bundle: OutputBundle, cache: ChunkScriptAnalysisCache) {
    rewriteBundleNpmImportsToLocalRoots(bundle, { 'ui-lib': '1.0.0' }, [], { analysisCache: cache })
  },
  platform(bundle: OutputBundle, cache: ChunkScriptAnalysisCache) {
    rewriteBundleNpmImportsByPlatform('alipay', bundle, { 'ui-lib': '1.0.0' }, undefined, { analysisCache: cache })
  },
}

function normalizedLocalRootFacts(analysis: NativeNpmChunkAnalysis) {
  return analysis.localRootFacts.map(fact => ({
    kind: fact.kind,
    requireIndex: fact.requireIndex ?? null,
    bindingName: fact.bindingName ?? null,
    referenceName: fact.referenceName ?? null,
    importee: fact.importee ?? null,
    secondArgumentStart: fact.secondArgumentStart ?? null,
    secondArgumentEnd: fact.secondArgumentEnd ?? null,
  }))
}

afterEach(() => vi.unstubAllEnvs())

describe.each(Object.entries(npmRewriters))('%s actual addon final chunk parity', (_name, rewriteNpm) => {
  it.each(['none', 'external', 'inline'])('matches complete JS output and %s source maps', (mode) => {
    const expected = createBundle(mode)
    const expectedCache: ChunkScriptAnalysisCache = new WeakMap()
    vi.stubEnv('WEAPP_VITE_NATIVE', '0')
    warmupBundleScriptAnalysis(expected, { cache: expectedCache })
    rewriteNpm(expected, expectedCache)
    rewriteBundlePlatformApi(expected, 'wpi', { analysisCache: expectedCache })

    vi.stubEnv('WEAPP_VITE_NATIVE', '1')
    vi.stubEnv('WEAPP_VITE_NATIVE_NPM_CHUNK', '1')
    vi.stubEnv('WEAPP_VITE_NATIVE_AST_PATH', fileURLToPath(new URL('../index.js', import.meta.url)))
    const actual = createBundle(mode)
    const chunks = Object.values(actual) as OutputChunk[]
    const inputs = chunks.map(chunk => ({ code: chunk.code, filename: chunk.fileName }))
    const direct = analyzeNpmChunksNative(inputs)
    const loaded = analyzeNpmChunksWithNative(inputs)
    expect(loaded).toHaveLength(inputs.length)
    for (const [index, directAnalysis] of direct.entries()) {
      const loadedAnalysis = loaded?.[index]
      expect(directAnalysis).not.toBeNull()
      expect(loadedAnalysis).not.toBeNull()
      expect(loadedAnalysis).toBeDefined()
      expect(loadedAnalysis?.requires).toEqual(directAnalysis!.requires)
      expect(loadedAnalysis?.platformApiRanges).toEqual(directAnalysis!.platformApiRanges)
      expect(normalizedLocalRootFacts(loadedAnalysis!)).toEqual(normalizedLocalRootFacts(directAnalysis!))
    }

    const cache: ChunkScriptAnalysisCache = new WeakMap()
    warmupBundleScriptAnalysis(actual, { cache })
    for (const chunk of chunks) {
      expect(getChunkNpmChunkAnalysis(chunk, cache)).toBeDefined()
    }
    rewriteNpm(actual, cache)
    for (const chunk of chunks) {
      expect(getChunkNpmChunkAnalysis(chunk, cache)).toBeUndefined()
      expect(getChunkNpmPlatformApiRanges(chunk, cache)).toBeDefined()
    }
    rewriteBundlePlatformApi(actual, 'wpi', { analysisCache: cache })

    expect(actual).toEqual(expected)
    for (const chunk of chunks) {
      expect(chunk.code).toContain(`var ${WEAPP_VITE_INJECTED_API_IDENTIFIER} = `)
      expect(chunk.code).toContain('parityMarker')
      expect(chunk.code.includes('sourceMappingURL=')).toBe(mode === 'inline')
    }
  })
})
