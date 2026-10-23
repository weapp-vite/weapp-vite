import type { OutputChunk } from 'rolldown'
import type { ChunkScriptAnalysisCache } from '../platform'
import { runInNewContext } from 'node:vm'
import { WEAPP_VITE_INJECTED_API_IDENTIFIER } from '@weapp-core/constants'
import MagicString from 'magic-string'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getVisitorKeys, parseJsLike, traverse } from '../../../../../../utils/babel'
import { rewriteChunkNpmImportsToLocalRoot } from '../localRoot'
import { getChunkScriptAnalysis, rewriteBundlePlatformApi } from '../platform'

vi.mock('../../../../../../utils/babel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../../utils/babel')>()
  return { ...actual, getVisitorKeys: vi.fn(actual.getVisitorKeys), parseJsLike: vi.fn(actual.parseJsLike), traverse: vi.fn(actual.traverse) }
})

const unrelatedRequire = String.raw`const matcher = /\B/; const dep = require('./relative')`

function createChunk(code: string): OutputChunk {
  return { code, fileName: 'pages/index.js', imports: [], moduleIds: [], map: null, type: 'chunk' } as unknown as OutputChunk
}

function rewriteNpm(chunk: OutputChunk, cache: ChunkScriptAnalysisCache, collectPlatformApiAccess?: boolean) {
  rewriteChunkNpmImportsToLocalRoot(chunk, '', undefined, { 'ui-lib': '1.0.0' }, {
    collectPlatformApiAccess,
    analysisCache: cache,
    astEngine: 'babel',
  })
}

function rewriteApi(chunk: OutputChunk, cache: ChunkScriptAnalysisCache) {
  rewriteBundlePlatformApi({ [chunk.fileName]: chunk }, 'wpi', { analysisCache: cache, astEngine: 'babel' })
}

function readChunk(chunk: OutputChunk) {
  const exports: Record<string, unknown> = {}
  const nativeRead = vi.fn((key: string) => `native:${key}`)
  const injectedRead = vi.fn((key: string) => `injected:${key}`)
  const native = { getStorageSync: nativeRead }
  runInNewContext(chunk.code, {
    exports,
    require: (request: string) => request,
    target: 'dynamic-module',
    __toESM: (value: unknown, nodeInterop?: number) => ({ value, nodeInterop }),
    wx: native,
    my: native,
    tt: native,
    swan: native,
    jd: native,
    xhs: native,
    wpi: { getStorageSync: injectedRead },
  })
  return { exports, nativeRead, injectedRead }
}

describe('joint npm and platform API negative candidates', () => {
  beforeEach(() => {
    vi.mocked(getVisitorKeys).mockClear()
    vi.mocked(parseJsLike).mockClear()
    vi.mocked(traverse).mockClear()
    vi.stubEnv('WEAPP_VITE_NATIVE', '0')
  })

  afterEach(() => vi.unstubAllEnvs())

  it.each([undefined, true])('records an API negative proof without scopes or sourcemap changes (collector=%s)', (collectPlatformApiAccess) => {
    const code = `${unrelatedRequire}; const labels = { wx: 'wx.getStorageSync' }; const host = typeof wx === 'undefined' ? labels : wx`
    const chunk = createChunk(code)
    const originalMap = new MagicString(code).generateMap({ hires: true, includeContent: true, source: 'src/pages/index.ts' })
    chunk.map = originalMap as any
    const cache: ChunkScriptAnalysisCache = new WeakMap()

    rewriteNpm(chunk, cache, collectPlatformApiAccess)
    expect(getChunkScriptAnalysis(chunk, { cache }).hasPlatformApiAccess).toBe(false)
    rewriteApi(chunk, cache)

    expect(parseJsLike).toHaveBeenCalledTimes(1)
    expect(traverse).not.toHaveBeenCalled()
    expect(chunk.code).toBe(code)
    expect(chunk.map).toBe(originalMap)
  })

  it('preserves bare platform aliases and invalidates a negative proof when code changes', () => {
    const code = `${unrelatedRequire}; const local = wx; exports.value = local.getStorageSync('key')`
    const chunk = createChunk(code)
    const cache: ChunkScriptAnalysisCache = new WeakMap()

    rewriteNpm(chunk, cache, true)
    rewriteApi(chunk, cache)
    expect(traverse).not.toHaveBeenCalled()
    expect(chunk.code).toBe(code)
    expect(readChunk(chunk).exports.value).toBe('native:key')

    chunk.code += `; exports.changed = wx['getStorageSync']('key')`
    rewriteApi(chunk, cache)
    expect(traverse).toHaveBeenCalledTimes(1)
    const result = readChunk(chunk)
    expect(result.exports).toEqual({ value: 'native:key', changed: 'injected:key' })
    expect(result.nativeRead).toHaveBeenCalledTimes(1)
    expect(result.injectedRead).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['free', `exports.value = wx.getStorageSync('key')`, 'injected:key', true],
    ['computed', `const method = 'getStorageSync'; exports.value = wx[method]('key')`, 'injected:key', true],
    ['optional', `exports.value = wx?.getStorageSync('key')`, 'injected:key', true],
    ['optional computed', `exports.value = wx?.['getStorageSync']('key')`, 'injected:key', true],
    ['escaped', String.raw`exports.value = \u0077x.getStorageSync('key')`, 'injected:key', true],
    ['shadowed', `exports.value = (wx => wx.getStorageSync('key'))({ getStorageSync: key => 'local:' + key })`, 'local:key', false],
    ['local alias', `const local = { getStorageSync: key => 'local:' + key }; const wx = local; exports.value = wx['getStorageSync']('key')`, 'local:key', false],
  ] as const)('retains scoped processing and runtime behavior for %s platform access', (_name, access, expected, shouldRewrite) => {
    const code = `${unrelatedRequire}; ${access}`
    const chunk = createChunk(code)
    const cache: ChunkScriptAnalysisCache = new WeakMap()

    rewriteNpm(chunk, cache, true)
    expect(traverse).toHaveBeenCalledTimes(1)
    expect(getChunkScriptAnalysis(chunk, { cache }).hasPlatformApiAccess).toBe(shouldRewrite)
    rewriteApi(chunk, cache)
    expect(traverse).toHaveBeenCalledTimes(shouldRewrite ? 2 : 1)
    expect(chunk.code.includes(`var ${WEAPP_VITE_INJECTED_API_IDENTIFIER} =`)).toBe(shouldRewrite)
    const result = readChunk(chunk)
    expect(result.exports.value).toBe(expected)
    expect(result.nativeRead).not.toHaveBeenCalled()
    expect(result.injectedRead).toHaveBeenCalledTimes(shouldRewrite ? 1 : 0)

    const reference = createChunk(code)
    const referenceCache: ChunkScriptAnalysisCache = new WeakMap()
    rewriteNpm(reference, referenceCache, false)
    rewriteApi(reference, referenceCache)
    expect(chunk).toEqual(reference)
  })

  it.each(['my', 'tt', 'swan', 'jd', 'xhs'])('retains optional computed %s access as a scoped candidate', (identifier) => {
    const chunk = createChunk(`${unrelatedRequire}; exports.value = ${identifier}?.['getStorageSync']('key')`)
    const cache: ChunkScriptAnalysisCache = new WeakMap()
    rewriteNpm(chunk, cache, true)
    expect(traverse).toHaveBeenCalledTimes(1)
    rewriteApi(chunk, cache)
    expect(readChunk(chunk).exports.value).toBe('injected:key')
  })

  it.each(['missing', 'throwing'])('keeps the original scoped fallback when visitor keys are %s', (failure) => {
    if (failure === 'missing') {
      vi.mocked(getVisitorKeys).mockReturnValueOnce({})
    }
    else {
      vi.mocked(getVisitorKeys).mockImplementationOnce(() => {
        throw new Error('candidate check failed')
      })
    }
    const chunk = createChunk(`const dep = require('ui-lib/button'); exports.value = wx.getStorageSync('key')`)
    const cache: ChunkScriptAnalysisCache = new WeakMap()
    rewriteNpm(chunk, cache, true)
    expect(traverse).toHaveBeenCalledTimes(1)
    expect(chunk.code).toContain('require("../miniprogram_npm/ui-lib/button")')
    rewriteApi(chunk, cache)
    expect(readChunk(chunk).exports.value).toBe('injected:key')
  })

  it('preserves npm rewrites, interop aliases and dynamic requires before later API rewrites', () => {
    const code = [
      `const dep = require('ui-lib/button'); const alias = dep; let assigned; assigned = alias`,
      `exports.wrapped = __toESM(assigned, 1)`,
      `exports.dynamic = require(target)`,
      `exports.value = wx['getStorageSync']('key')`,
    ].join('\n')
    const chunk = createChunk(code)
    const cache: ChunkScriptAnalysisCache = new WeakMap()
    rewriteNpm(chunk, cache, true)
    expect(traverse).toHaveBeenCalledTimes(1)
    expect(chunk.code).toContain('require("../miniprogram_npm/ui-lib/button")')
    expect(chunk.code).toContain('__toESM(assigned)')
    expect(chunk.code).toContain('require(target)')
    rewriteApi(chunk, cache)
    expect(readChunk(chunk).exports).toEqual({
      wrapped: { value: '../miniprogram_npm/ui-lib/button', nodeInterop: undefined },
      dynamic: 'dynamic-module',
      value: 'injected:key',
    })

    const reference = createChunk(code)
    const referenceCache: ChunkScriptAnalysisCache = new WeakMap()
    rewriteNpm(reference, referenceCache, false)
    rewriteApi(reference, referenceCache)
    expect(chunk).toEqual(reference)
  })
})
