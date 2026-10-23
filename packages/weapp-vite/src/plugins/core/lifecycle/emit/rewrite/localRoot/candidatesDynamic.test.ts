import type { OutputChunk } from 'rolldown'
import type { ChunkScriptAnalysisCache } from '../platform'
import { runInNewContext } from 'node:vm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rewriteBundleNpmImportsToLocalRoots, rewriteChunkNpmImportsToLocalRoot } from '../localRoot'
import { rewriteBundlePlatformApi } from '../platform'

function createChunk(): OutputChunk {
  return {
    code: [
      `exports.first = require('./relative')`,
      `exports.button = require('ui-lib/button')`,
      `exports.value = wx.getStorageSync('key')`,
    ].join('\n'),
    fileName: 'pages/index.js',
    imports: [],
    moduleIds: [],
    map: null,
    type: 'chunk',
  } as unknown as OutputChunk
}

function expectOriginalMatcherResult(chunk: OutputChunk, analysisCache: ChunkScriptAnalysisCache) {
  rewriteBundlePlatformApi({ [chunk.fileName]: chunk }, 'wpi', { analysisCache, astEngine: 'babel' })
  const exports: Record<string, unknown> = {}
  const nativeRead = vi.fn(() => 'native')
  runInNewContext(chunk.code, {
    exports,
    require: (request: string) => request,
    wx: { getStorageSync: nativeRead },
    wpi: { getStorageSync: (key: string) => `injected:${key}` },
  })
  expect(exports).toEqual({
    first: './relative',
    button: '../miniprogram_npm/ui-lib/button',
    value: 'injected:key',
  })
  expect(nativeRead).not.toHaveBeenCalled()
}

describe('dynamic npm candidate scopes', () => {
  beforeEach(() => vi.stubEnv('WEAPP_VITE_NATIVE', '0'))
  afterEach(() => vi.unstubAllEnvs())

  it.each([undefined, false, true])('reads dependency Proxy keys only for each original require match (API collector=%s)', (collectPlatformApiAccess) => {
    let reads = 0
    const ownKeys = vi.fn(() => ++reads === 1 ? ['other-lib'] : ['ui-lib'])
    const dependencies = new Proxy({ 'other-lib': '1.0.0', 'ui-lib': '1.0.0' }, { ownKeys })
    const chunk = createChunk()
    const analysisCache: ChunkScriptAnalysisCache = new WeakMap()

    // 首次读取属于相对 require 的原 matcher；第二次读取才决定 ui-lib 的真实匹配。
    rewriteBundleNpmImportsToLocalRoots({ [chunk.fileName]: chunk }, dependencies, [], {
      analysisCache,
      collectPlatformApiAccess,
      astEngine: 'babel',
    })

    expect(ownKeys).toHaveBeenCalledTimes(2)
    expectOriginalMatcherResult(chunk, analysisCache)
  })

  it.each([undefined, false, true])('leaves pattern getter reads to the original matcher (API collector=%s)', (collectPlatformApiAccess) => {
    let reads = 0
    const readPattern = vi.fn(() => ++reads === 1 ? 'other-lib' : 'ui-lib')
    const patterns = ['ui-lib']
    Object.defineProperty(patterns, 0, { configurable: true, enumerable: true, get: readPattern })
    const chunk = createChunk()
    const analysisCache: ChunkScriptAnalysisCache = new WeakMap()

    rewriteChunkNpmImportsToLocalRoot(chunk, '', patterns, {}, {
      analysisCache,
      collectPlatformApiAccess,
      astEngine: 'babel',
    })

    expect(readPattern).toHaveBeenCalledTimes(2)
    expectOriginalMatcherResult(chunk, analysisCache)
  })
})
