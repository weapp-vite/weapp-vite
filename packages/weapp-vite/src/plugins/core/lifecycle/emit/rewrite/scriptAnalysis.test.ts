import type { OutputBundle, OutputChunk } from 'rolldown'
import type { ChunkScriptAnalysisCache } from './platform'
import { Buffer } from 'node:buffer'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { WEAPP_VITE_INJECTED_API_IDENTIFIER } from '@weapp-core/constants'
import MagicString from 'magic-string'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseJsLike } from '../../../../../utils/babel'
import { rewriteBundleNpmImportsToLocalRoots } from './localRoot'
import { getChunkScriptAnalysis, rewriteBundleNpmImportsByPlatform, rewriteBundlePlatformApi } from './platform'

vi.mock('../../../../../utils/babel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../utils/babel')>()
  return { ...actual, parseJsLike: vi.fn(actual.parseJsLike) }
})

function createChunk(code: string): OutputChunk {
  return {
    code,
    fileName: 'pages/index.js',
    map: null,
    type: 'chunk',
  } as OutputChunk
}

const npmRewriters = {
  localRoot(bundle: OutputBundle, analysisCache: ChunkScriptAnalysisCache) {
    rewriteBundleNpmImportsToLocalRoots(bundle, { 'ui-lib': '1.0.0' }, [], { analysisCache })
  },
  platform(bundle: OutputBundle, analysisCache: ChunkScriptAnalysisCache) {
    rewriteBundleNpmImportsByPlatform('alipay', bundle, { 'ui-lib': '1.0.0' }, undefined, { analysisCache })
  },
}

describe.each(Object.entries(npmRewriters))('%s npm rewrite analysis', (_name, rewriteNpm) => {
  beforeEach(() => {
    vi.mocked(parseJsLike).mockClear()
    vi.stubEnv('WEAPP_VITE_NATIVE', '0')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    ['relative require', `const dep = require('./dep')`],
    ['rewritten npm require', `const dep = require('ui-lib/button')`],
    ['string and comment', `const dep = require('./dep'); const text = 'wx.getStorageSync()'; /* my.alert() */`],
    ['local binding', `const dep = require('./dep'); function run(wx) { return wx.getStorageSync('key') }`],
    ['escaped local binding', String.raw`const dep = require('./dep'); function run(\u0077x) { return \u0077x.getStorageSync('key') }`],
  ])('skips a second Babel parse for %s without free platform access', (_case, code) => {
    const chunk = createChunk(code)
    const bundle = { [chunk.fileName]: chunk }
    const cache: ChunkScriptAnalysisCache = new WeakMap()

    rewriteNpm(bundle, cache)
    const analysis = getChunkScriptAnalysis(chunk, { cache })
    rewriteBundlePlatformApi(bundle, 'wpi', { analysisCache: cache })

    expect(parseJsLike).toHaveBeenCalledTimes(1)
    expect(analysis.hasPlatformApiAccess).toBe(false)
    expect(chunk.code).not.toContain(WEAPP_VITE_INJECTED_API_IDENTIFIER)
  })

  it.each([
    ['escaped identifier', String.raw`\u0077x.getStorageSync('key')`],
    ['escaped full identifier', String.raw`\u{77}\u{78}.getStorageSync('key')`],
    ['computed member', `wx['getStorageSync']('key')`],
    ['optional member', `wx?.getStorageSync('key')`],
    ['comment between tokens', `wx /* host */ .getStorageSync('key')`],
    ['shadowed require', `function run(require) { require('local'); return wx.getStorageSync('key') }`],
  ])('retains platform rewriting for %s', (_case, expression) => {
    const chunk = createChunk(`const dep = require('ui-lib/button');\n${expression}`)
    const bundle = { [chunk.fileName]: chunk }
    const cache: ChunkScriptAnalysisCache = new WeakMap()

    rewriteNpm(bundle, cache)
    expect(getChunkScriptAnalysis(chunk, { cache }).hasPlatformApiAccess).toBe(true)
    rewriteBundlePlatformApi(bundle, 'wpi', { analysisCache: cache })

    expect(chunk.code).toContain(`var ${WEAPP_VITE_INJECTED_API_IDENTIFIER} = `)
    expect(chunk.code).toContain('getStorageSync')
  })

  it('invalidates precise facts after a later code change', () => {
    const chunk = createChunk(`const dep = require('./dep')`)
    const bundle = { [chunk.fileName]: chunk }
    const cache: ChunkScriptAnalysisCache = new WeakMap()
    rewriteNpm(bundle, cache)
    expect(getChunkScriptAnalysis(chunk, { cache }).hasPlatformApiAccess).toBe(false)

    chunk.code += `\nwx.getStorageSync('key')`
    rewriteBundlePlatformApi(bundle, 'wpi', { analysisCache: cache })

    expect(chunk.code).toContain(`${WEAPP_VITE_INJECTED_API_IDENTIFIER}.getStorageSync`)
  })

  it.each(['external', 'inline'])('preserves %s sourcemaps across npm and platform rewrites', (mode) => {
    const source = 'src/pages/index.ts'
    const code = [
      `const dep = require('ui-lib/button')`,
      `wx.getStorageSync('key')`,
      `const rewriteMarker = dep`,
    ].join('\n')
    const chunk = createChunk(code)
    const sourceMap = new MagicString(code).generateMap({ hires: true, includeContent: true, source })
    if (mode === 'inline') {
      chunk.code += `\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(sourceMap.toString()).toString('base64')}`
    }
    else {
      chunk.map = sourceMap as any
    }
    const bundle = { [chunk.fileName]: chunk }
    const cache: ChunkScriptAnalysisCache = new WeakMap()

    rewriteNpm(bundle, cache)
    rewriteBundlePlatformApi(bundle, 'wpi', { analysisCache: cache })

    expect(chunk.code).not.toContain(`require('ui-lib/button')`)
    expect(chunk.code).toContain(`${WEAPP_VITE_INJECTED_API_IDENTIFIER}.getStorageSync`)
    const markerPrefix = chunk.code.slice(0, chunk.code.indexOf('rewriteMarker'))
    expect(originalPositionFor(new TraceMap(chunk.map as any), {
      line: markerPrefix.split('\n').length,
      column: markerPrefix.length - markerPrefix.lastIndexOf('\n') - 1,
    })).toMatchObject({ source, line: 3, column: 6 })
    expect(chunk.code.includes('sourceMappingURL=')).toBe(mode === 'inline')
  })
})
