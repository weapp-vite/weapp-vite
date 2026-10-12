import type { OutputChunk } from 'rolldown'
import type { ChunkScriptAnalysisCache } from '../platform'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getVisitorKeys, parseJsLike, traverse } from '../../../../../../utils/babel'
import { createPlatformApiAccessCollector } from '../../../platformApiRewrite'
import { rewriteBundleNpmImportsToLocalRoots, rewriteChunkNpmImportsToLocalRoot } from '../localRoot'
import { getChunkScriptAnalysis } from '../platform'

vi.mock('../../../../../../utils/babel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../../utils/babel')>()
  return { ...actual, getVisitorKeys: vi.fn(actual.getVisitorKeys), parseJsLike: vi.fn(actual.parseJsLike), traverse: vi.fn(actual.traverse) }
})

vi.mock('../../../platformApiRewrite', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../platformApiRewrite')>()
  return { ...actual, createPlatformApiAccessCollector: vi.fn(actual.createPlatformApiAccessCollector) }
})

function createChunk(code: string): OutputChunk {
  return { code, fileName: 'pages/index.js', imports: [], moduleIds: [], map: null, type: 'chunk' } as unknown as OutputChunk
}

function rewrite(code: string, collectPlatformApiAccess: boolean, patterns?: (string | RegExp)[]) {
  const chunk = createChunk(code)
  const cache: ChunkScriptAnalysisCache = new WeakMap()
  rewriteBundleNpmImportsToLocalRoots({ [chunk.fileName]: chunk }, { 'ui-lib': '1.0.0' }, patterns ? [{ root: 'pages', dependencies: patterns }] : [], {
    collectPlatformApiAccess,
    analysisCache: cache,
  })
  return { chunk, analysis: getChunkScriptAnalysis(chunk, { cache }) }
}

describe('local root scoped traversal candidates', () => {
  beforeEach(() => {
    vi.mocked(parseJsLike).mockClear()
    vi.mocked(traverse).mockClear()
    vi.mocked(getVisitorKeys).mockClear()
    vi.mocked(createPlatformApiAccessCollector).mockClear()
    vi.stubEnv('WEAPP_VITE_NATIVE', '0')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([false, true])('limits scope construction to the requested collector for unrelated vendor requires (collector=%s)', (collectPlatformApiAccess) => {
    const code = [
      `const dep = require('./vendor')`,
      String.raw`const matcher = /\B/`,
      `const note = 'ui-lib wx.getStorageSync()'`,
      ...Array.from({ length: 400 }, (_, index) => `function item${index}(value) { const local = value + ${index}; return () => local }`),
    ].join('\n')
    const { chunk, analysis } = rewrite(code, collectPlatformApiAccess)

    expect(chunk.code).toBe(code)
    expect(parseJsLike).toHaveBeenCalledTimes(1)
    expect(traverse).toHaveBeenCalledTimes(collectPlatformApiAccess ? 1 : 0)
    expect(createPlatformApiAccessCollector).toHaveBeenCalledTimes(collectPlatformApiAccess ? 1 : 0)
    expect(analysis.hasPlatformApiAccess).toBe(!collectPlatformApiAccess)
  })

  it.each([
    ['escaped npm', String.raw`const dep = require('\x75i-lib/button')`],
    ['static template', 'const dep = require(`ui-lib/button`)'],
    ['escaped callee', String.raw`const dep = \u0072equire('ui-lib/button')`],
    ['shadowed require', `function local(require) { return require('ui-lib/button') }`],
    ['localized interop', `const dep = require('../miniprogram_npm/other/button'); const alias = dep; const wrapped = __toESM(alias, 1)`],
  ])('retains scope-aware npm processing for %s', (_name, code) => {
    rewrite(code, false)
    expect(parseJsLike).toHaveBeenCalledTimes(1)
    expect(traverse).toHaveBeenCalledTimes(1)
  })

  it('does not treat a dependency name inside a relative vendor path as an npm candidate', () => {
    const code = String.raw`const matcher = /\B/; const dep = require('./weapp-vendors/ui-lib-runtime.js')`
    const { chunk } = rewrite(code, false)
    expect(chunk.code).toBe(code)
    expect(parseJsLike).toHaveBeenCalledTimes(1)
    expect(traverse).not.toHaveBeenCalled()
  })

  it('falls back to the original scoped traversal when visitor keys are unavailable', () => {
    vi.mocked(getVisitorKeys).mockReturnValueOnce({})
    const code = String.raw`const matcher = /\B/; const dep = require('./relative')`
    const { chunk } = rewrite(code, false)
    expect(chunk.code).toBe(code)
    expect(traverse).toHaveBeenCalledTimes(1)
  })

  it('preserves npm rewriting if the AST candidate check fails', () => {
    vi.mocked(getVisitorKeys).mockImplementationOnce(() => {
      throw new Error('candidate check failed')
    })
    const { chunk } = rewrite(`const dep = require('ui-lib/button')`, false)
    expect(traverse).toHaveBeenCalledTimes(1)
    expect(chunk.code).toContain('require("../miniprogram_npm/ui-lib/button")')
  })

  it.each([undefined, true])('preserves dependency enumeration with a precise collector (%s)', (collectPlatformApiAccess) => {
    const ownKeys = vi.fn(Reflect.ownKeys)
    const dependencies = new Proxy({ 'ui-lib': '1.0.0' }, { ownKeys })
    const chunk = createChunk(`function local(require) { return require('ui-lib/button') }; const dep = require('ui-lib/button')`)
    rewriteBundleNpmImportsToLocalRoots({ [chunk.fileName]: chunk }, dependencies, [], { collectPlatformApiAccess })
    expect(ownKeys).toHaveBeenCalledTimes(1)
    expect(traverse).toHaveBeenCalledTimes(1)
    expect(chunk.code).toContain(`return require('ui-lib/button')`)
    expect(chunk.code).toContain('require("../miniprogram_npm/ui-lib/button")')
  })

  it('keeps dependency proxies on the original AST path after an ambiguous text check', () => {
    const ownKeys = vi.fn(Reflect.ownKeys)
    const dependencies = new Proxy({ 'ui-lib': '1.0.0' }, { ownKeys })
    const code = String.raw`const matcher = /\B/; const dep = require('./relative')`
    const chunk = createChunk(code)
    rewriteBundleNpmImportsToLocalRoots({ [chunk.fileName]: chunk }, dependencies, [], { collectPlatformApiAccess: false })
    expect(chunk.code).toBe(code)
    expect(ownKeys).toHaveBeenCalledTimes(2)
    expect(traverse).toHaveBeenCalledTimes(1)
  })

  it('does not confuse a dependency substring with a matching package token', () => {
    const code = `const dep = require('ui-library/button')`
    const { chunk } = rewrite(code, false)
    expect(chunk.code).toBe(code)
    expect(parseJsLike).toHaveBeenCalledTimes(1)
    expect(traverse).not.toHaveBeenCalled()
  })

  it('preserves pattern getters that change between candidate collection and matching', () => {
    let reads = 0
    const patterns = ['ui-lib']
    Object.defineProperty(patterns, 0, {
      get: () => ++reads === 1 ? 'ui-lib' : 'other-lib',
    })
    const chunk = createChunk(String.raw`const matcher = /\B/; const dep = require('other-lib/button')`)
    rewriteChunkNpmImportsToLocalRoot(chunk, '', patterns, {}, { collectPlatformApiAccess: false })

    expect(chunk.code).toContain('require("../miniprogram_npm/other-lib/button")')
    expect(reads).toBe(2)
    expect(traverse).toHaveBeenCalledTimes(1)
  })

  it.each(['own', 'inherited'])('preserves a %s pattern iterator whose values differ from array entries', (owner) => {
    const patterns = ['other-lib']
    const iterator = vi.fn(function* () {
      yield 'ui-lib'
    })
    const target = owner === 'own' ? patterns : Object.create(Array.prototype)
    Object.defineProperty(target, Symbol.iterator, { value: iterator })
    if (owner === 'inherited') {
      Object.setPrototypeOf(patterns, target)
    }
    const chunk = createChunk(String.raw`const matcher = /\B/; const dep = require('other-lib/button')`)
    rewriteChunkNpmImportsToLocalRoot(chunk, '', patterns, {}, { collectPlatformApiAccess: false })

    expect(chunk.code).toContain('require("../miniprogram_npm/other-lib/button")')
    expect(iterator).toHaveBeenCalledTimes(1)
    expect(traverse).toHaveBeenCalledTimes(1)
  })

  it.each(['own', 'inherited'])('preserves a %s pattern matcher that accepts another dependency', (owner) => {
    const patterns = ['ui-lib']
    const some = vi.fn(() => true)
    const target = owner === 'own' ? patterns : Object.create(Array.prototype)
    Object.defineProperty(target, 'some', { value: some })
    if (owner === 'inherited') {
      Object.setPrototypeOf(patterns, target)
    }
    const chunk = createChunk(String.raw`const matcher = /\B/; const dep = require('other-lib/button')`)
    rewriteChunkNpmImportsToLocalRoot(chunk, '', patterns, {}, { collectPlatformApiAccess: false })

    expect(chunk.code).toContain('require("../miniprogram_npm/other-lib/button")')
    expect(some).toHaveBeenCalledTimes(1)
    expect(traverse).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['computed', `wx['getStorageSync']('key')`],
    ['optional', `wx?.getStorageSync('key')`],
    ['escaped', String.raw`\u0077x.getStorageSync('key')`],
    ['shadowed', `function local(wx) { return wx.getStorageSync('key') }`],
  ])('retains precise scope collection for %s platform access', (_name, access) => {
    const { analysis } = rewrite(`const dep = require('./relative'); ${access}`, true)
    expect(traverse).toHaveBeenCalledTimes(1)
    expect(analysis.hasPlatformApiAccess).toBe(_name !== 'shadowed')
  })

  it.each([{ patterns: [/^ui-lib$/] }, { patterns: ['./ui-lib'] }])('keeps unknown dependency rules on the scoped path: $patterns', ({ patterns }) => {
    rewrite(String.raw`const matcher = /\B/; const dep = require('./relative')`, false, patterns)
    expect(parseJsLike).toHaveBeenCalledTimes(1)
    expect(traverse).toHaveBeenCalledTimes(1)
  })

  it('ignores platform members when no platform consumer is requested', () => {
    const code = String.raw`const matcher = /\B/; const dep = require('./relative'); wx.getStorageSync('key')`
    const { chunk, analysis } = rewrite(code, false)
    expect(chunk.code).toBe(code)
    expect(traverse).not.toHaveBeenCalled()
    expect(analysis.hasPlatformApiAccess).toBe(true)
  })
})
