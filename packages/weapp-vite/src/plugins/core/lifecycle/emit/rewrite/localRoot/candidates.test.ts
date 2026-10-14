import type { OutputAsset, OutputChunk } from 'rolldown'
import type { ChunkScriptAnalysisCache } from '../platform'
import { Buffer } from 'node:buffer'
import { WEAPP_VITE_INJECTED_API_IDENTIFIER } from '@weapp-core/constants'
import MagicString from 'magic-string'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseJsLike } from '../../../../../../utils/babel'
import { createPlatformApiAccessCollector } from '../../../platformApiRewrite'
import { rewriteBundleNpmImportsToLocalRoots } from '../localRoot'
import { getChunkScriptAnalysis, rewriteBundlePlatformApi } from '../platform'

vi.mock('../../../../../../utils/babel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../../utils/babel')>()
  return { ...actual, parseJsLike: vi.fn(actual.parseJsLike) }
})

vi.mock('../../../platformApiRewrite', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../platformApiRewrite')>()
  return { ...actual, createPlatformApiAccessCollector: vi.fn(actual.createPlatformApiAccessCollector) }
})

function createChunk(code: string, fileName = 'pages/index.js'): OutputChunk {
  return { code, fileName, imports: [], moduleIds: [], map: null, type: 'chunk' } as unknown as OutputChunk
}

describe('local root negative candidates', () => {
  beforeEach(() => {
    vi.mocked(parseJsLike).mockClear()
    vi.mocked(createPlatformApiAccessCollector).mockClear()
    vi.stubEnv('WEAPP_VITE_NATIVE', '0')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each(['none', 'external', 'inline'])('preserves %s sourcemaps without parsing an unrelated require', (mode) => {
    const code = `const dep = require('../../weapp-vendors/wevu-runtime.js')`
    const chunk = createChunk(code)
    const map = new MagicString(code).generateMap({ hires: true, includeContent: true, source: 'src/pages/index.ts' })
    if (mode === 'external') {
      chunk.map = map as any
    }
    else if (mode === 'inline') {
      chunk.code += `\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(map.toString()).toString('base64')}`
    }
    const originalCode = chunk.code
    const originalMap = chunk.map

    rewriteBundleNpmImportsToLocalRoots({ [chunk.fileName]: chunk }, { '@vant/weapp': '1.0.0' }, [], {
      collectPlatformApiAccess: false,
      analysisCache: new WeakMap(),
    })

    expect(chunk.code).toBe(originalCode)
    expect(chunk.map).toBe(originalMap)
    expect(parseJsLike).not.toHaveBeenCalled()
    expect(createPlatformApiAccessCollector).not.toHaveBeenCalled()
  })

  it('rejects required substrings in a large vendor without a require identifier', () => {
    const code = [
      `const payload = '${'x'.repeat(160000)}'`,
      `const message = 'is required by the runtime'`,
      `const flag = entry?.required`,
      String.raw`const matcher = /\B/`,
    ].join('\n')
    const chunk = createChunk(code)

    rewriteBundleNpmImportsToLocalRoots({ [chunk.fileName]: chunk }, { '@vant/weapp': '1.0.0' }, [], {
      collectPlatformApiAccess: false,
    })

    expect(chunk.code).toBe(code)
    expect(parseJsLike).not.toHaveBeenCalled()
  })

  it.each([
    ['member require', `const dep = host.require('./relative')`],
    ['dynamic require', `const dep = require(target)`],
    ['dynamic import', `const required = true; import('./relative')`],
    ['unrelated literal', `const dep = require('other-lib/button')`],
  ])('skips %s with no dependency candidate', (_name, code) => {
    const chunk = createChunk(code)
    rewriteBundleNpmImportsToLocalRoots({ [chunk.fileName]: chunk }, { 'ui-lib': '1.0.0' }, [], {
      collectPlatformApiAccess: false,
    })

    expect(chunk.code).toBe(code)
    expect(parseJsLike).not.toHaveBeenCalled()
  })

  it('precomputes a fallback dependency scope once for several chunks', () => {
    const ownKeys = vi.fn(Reflect.ownKeys)
    const dependencies = new Proxy({ 'ui-lib': '1.0.0' }, { ownKeys })
    const first = createChunk(`const dep = require('./first')`)
    const second = createChunk(`const dep = require('./second')`, 'pages/second.js')

    rewriteBundleNpmImportsToLocalRoots({ [first.fileName]: first, [second.fileName]: second }, dependencies, [], {
      collectPlatformApiAccess: false,
    })

    expect(ownKeys).toHaveBeenCalledTimes(1)
    expect(parseJsLike).not.toHaveBeenCalled()
  })

  it('uses the most specific root scope independently of the main dependency scope', () => {
    const main = createChunk(`const dep = require('ui-lib/button')`)
    const sub = createChunk(`const dep = require('ui-lib/button')`, 'pkg-a/pages/index.js')
    const nested = createChunk(`const dep = require('other-lib/button')`, 'pkg-a/nested/pages/index.js')
    rewriteBundleNpmImportsToLocalRoots({ [main.fileName]: main, [sub.fileName]: sub, [nested.fileName]: nested }, { 'ui-lib': '1.0.0' }, [
      { root: 'pkg-a', dependencies: ['other-lib'] },
      { root: 'pkg-a/nested', dependencies: ['other-lib'] },
    ], { collectPlatformApiAccess: false })

    expect(main.code).toContain('require("../miniprogram_npm/ui-lib/button")')
    expect(sub.code).toBe(`const dep = require('ui-lib/button')`)
    expect(nested.code).toContain('require("../miniprogram_npm/other-lib/button")')
    expect(parseJsLike).toHaveBeenCalledTimes(2)
  })

  it('keeps the original traversal when unrelated text includes a dependency token', () => {
    const code = `const dep = require('./relative'); const note = 'ui-lib'`
    const chunk = createChunk(code)
    rewriteBundleNpmImportsToLocalRoots({ [chunk.fileName]: chunk }, { 'ui-lib': '1.0.0' }, [], { collectPlatformApiAccess: false })

    expect(chunk.code).toBe(code)
    expect(parseJsLike).toHaveBeenCalledTimes(1)
  })

  it('keeps the independent JSON rewrite after all scripts take the negative path', () => {
    const chunk = createChunk(`const dep = require(target)`)
    const json = {
      type: 'asset',
      fileName: 'pages/index.json',
      source: JSON.stringify({ usingComponents: { button: 'ui-lib/button' } }),
    } as OutputAsset
    rewriteBundleNpmImportsToLocalRoots({ [chunk.fileName]: chunk, [json.fileName]: json }, { 'ui-lib': '1.0.0' }, [], {
      collectPlatformApiAccess: false,
    })

    const result = JSON.parse(String(json.source)) as { usingComponents: Record<string, string> }
    expect(result.usingComponents.button).toBe('../miniprogram_npm/ui-lib/button')
    expect(parseJsLike).not.toHaveBeenCalled()
  })

  it.each([undefined, true])('retains the precise platform collector when collectPlatformApiAccess is %s', (collectPlatformApiAccess) => {
    const chunk = createChunk(`const dep = require('./relative'); function run(wx) { return wx.getStorageSync('key') }`)
    const analysisCache: ChunkScriptAnalysisCache = new WeakMap()
    rewriteBundleNpmImportsToLocalRoots({ [chunk.fileName]: chunk }, { 'ui-lib': '1.0.0' }, [], {
      collectPlatformApiAccess,
      analysisCache,
    })

    expect(parseJsLike).toHaveBeenCalledTimes(1)
    expect(createPlatformApiAccessCollector).toHaveBeenCalledTimes(1)
    expect(getChunkScriptAnalysis(chunk, { cache: analysisCache }).hasPlatformApiAccess).toBe(false)
  })

  it('leaves an existing precise cache entry intact when skipping the npm traversal', () => {
    const chunk = createChunk(`const dep = require('./relative')`)
    const analysisCache: ChunkScriptAnalysisCache = new WeakMap()
    const bundle = { [chunk.fileName]: chunk }
    rewriteBundleNpmImportsToLocalRoots(bundle, { 'ui-lib': '1.0.0' }, [], { analysisCache })
    const cached = analysisCache.get(chunk)
    vi.mocked(parseJsLike).mockClear()

    rewriteBundleNpmImportsToLocalRoots(bundle, { 'ui-lib': '1.0.0' }, [], { analysisCache, collectPlatformApiAccess: false })

    expect(analysisCache.get(chunk)).toBe(cached)
    expect(cached?.analysis.hasPlatformApiAccess).toBe(false)
    expect(parseJsLike).not.toHaveBeenCalled()
  })

  it('keeps conservative cache facts and invalidates them after a source change', () => {
    const chunk = createChunk(`const dep = require('./relative')`)
    const analysisCache: ChunkScriptAnalysisCache = new WeakMap()
    const bundle = { [chunk.fileName]: chunk }
    rewriteBundleNpmImportsToLocalRoots(bundle, { 'ui-lib': '1.0.0' }, [], { analysisCache, collectPlatformApiAccess: false })

    expect(getChunkScriptAnalysis(chunk, { cache: analysisCache }).hasPlatformApiAccess).toBe(true)
    expect(parseJsLike).not.toHaveBeenCalled()
    chunk.code += `\nwx.getStorageSync('key')`
    rewriteBundlePlatformApi(bundle, 'wpi', { analysisCache })

    expect(chunk.code).toContain(`${WEAPP_VITE_INJECTED_API_IDENTIFIER}.getStorageSync`)
  })
})
