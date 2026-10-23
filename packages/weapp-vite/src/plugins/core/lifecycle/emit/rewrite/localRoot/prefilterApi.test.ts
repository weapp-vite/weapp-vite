import type { OutputChunk } from 'rolldown'
import type { ChunkScriptAnalysisCache } from '../platform'
import { Buffer } from 'node:buffer'
import { runInNewContext } from 'node:vm'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import MagicString from 'magic-string'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseJsLike } from '../../../../../../utils/babel'
import { rewriteBundleNpmImportsToLocalRoots, rewriteChunkNpmImportsToLocalRoot } from '../localRoot'
import { rewriteBundlePlatformApi } from '../platform'

vi.mock('../../../../../../utils/babel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../../utils/babel')>()
  return { ...actual, parseJsLike: vi.fn(actual.parseJsLike) }
})

const source = 'src/pages/index.ts'
const dependencies = { 'ui-lib': '1.0.0' }
const marker = 'apiPrefilterMarker'
const mapModes = ['none', 'external', 'inline'] as const

function createChunk(code: string, mode: typeof mapModes[number] = 'none') {
  const originalMap = new MagicString(code).generateMap({ hires: true, includeContent: true, source })
  const chunk = {
    code,
    fileName: 'pages/index.js',
    imports: [],
    moduleIds: [],
    map: mode === 'external' ? originalMap : null,
    type: 'chunk',
  } as unknown as OutputChunk
  if (mode === 'inline') {
    chunk.code += `\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(originalMap.toString()).toString('base64')}`
  }
  return { chunk, originalMap }
}

const npmRewriters = {
  bundle(chunk: OutputChunk, analysisCache: ChunkScriptAnalysisCache) {
    rewriteBundleNpmImportsToLocalRoots({ [chunk.fileName]: chunk }, dependencies, [], {
      analysisCache,
      collectPlatformApiAccess: true,
      astEngine: 'babel',
    })
  },
  chunk(chunk: OutputChunk, analysisCache: ChunkScriptAnalysisCache) {
    rewriteChunkNpmImportsToLocalRoot(chunk, '', undefined, dependencies, {
      analysisCache,
      collectPlatformApiAccess: true,
      astEngine: 'babel',
    })
  },
}

function expectReadResult(chunk: OutputChunk, expected: string) {
  const exports: Record<string, unknown> = {}
  const nativeRead = vi.fn(() => 'native')
  const injectedRead = vi.fn((key: string) => `injected:${key}`)
  runInNewContext(chunk.code, {
    exports,
    require: () => ({}),
    wx: { getStorageSync: nativeRead },
    wpi: { getStorageSync: injectedRead },
  })
  expect(exports[marker]).toBe(expected)
  expect(nativeRead).not.toHaveBeenCalled()
  expect(injectedRead).toHaveBeenCalledTimes(expected === 'injected:key' ? 1 : 0)
}

describe('npm negative candidates with a later platform API consumer', () => {
  beforeEach(() => {
    vi.mocked(parseJsLike).mockClear()
    vi.stubEnv('WEAPP_VITE_NATIVE', '0')
  })

  afterEach(() => vi.unstubAllEnvs())

  it.each(Object.entries(npmRewriters))('%s leaves an unrelated require for the API phase without parsing it twice', (_name, rewriteNpm) => {
    const code = [
      `const runtime = require('./runtime.js')`,
      `const readValue = () => wx.getStorageSync('key')`,
      `exports.${marker} = readValue()`,
    ].join('\n')
    const { chunk } = createChunk(code)
    const cache: ChunkScriptAnalysisCache = new WeakMap()

    rewriteNpm(chunk, cache)

    expect(chunk.code).toBe(code)
    expect.soft(parseJsLike).not.toHaveBeenCalled()
    rewriteBundlePlatformApi({ [chunk.fileName]: chunk }, 'wpi', { analysisCache: cache, astEngine: 'babel' })

    expectReadResult(chunk, 'injected:key')
    expect(parseJsLike).toHaveBeenCalledTimes(1)
  })

  describe.each(mapModes)('%s sourcemap', (mode) => {
    it.each([
      ['free', `const readValue = () => wx.getStorageSync('key')`, 'readValue()', 'injected:key'],
      ['escaped', String.raw`const readValue = () => \u0077x.getStorageSync('key')`, 'readValue()', 'injected:key'],
      ['shadowed', `const readValue = wx => wx.getStorageSync('key')`, `readValue({ getStorageSync: key => 'local:' + key })`, 'local:key'],
    ])('keeps %s API behavior and source locations after the npm phase', (_name, declaration, call, expected) => {
      const code = [
        `const runtime = require('./runtime.js')`,
        declaration,
        `exports.${marker} = ${call}`,
      ].join('\n')
      const { chunk, originalMap } = createChunk(code, mode)
      const reference = createChunk(code, mode).chunk
      const cache: ChunkScriptAnalysisCache = new WeakMap()

      rewriteBundlePlatformApi({ [reference.fileName]: reference }, 'wpi', { analysisCache: new WeakMap(), astEngine: 'babel' })
      npmRewriters.bundle(chunk, cache)
      rewriteBundlePlatformApi({ [chunk.fileName]: chunk }, 'wpi', { analysisCache: cache, astEngine: 'babel' })

      expect(chunk).toEqual(reference)
      expectReadResult(chunk, expected)
      expect(chunk.code.includes('sourceMappingURL=')).toBe(mode === 'inline')
      if (mode === 'none') {
        expect(chunk.map).toBeNull()
        return
      }
      const prefix = chunk.code.slice(0, chunk.code.indexOf(marker))
      expect(originalPositionFor(new TraceMap((chunk.map ?? originalMap) as any), {
        line: prefix.split('\n').length,
        column: prefix.length - prefix.lastIndexOf('\n') - 1,
      })).toMatchObject({ source, line: 3, column: 8 })
    })
  })
})
