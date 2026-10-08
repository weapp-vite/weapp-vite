import { describe, expect, it, vi } from 'vitest'
import { createChunk, rewriteChunkFromSummary, rewriteWithNative, rewriteWithProduction } from './rewrite'

const options = { dependencies: { 'ui-lib': '1.0.0' }, globalName: 'wpi' }
const code = 'const label = "中文😀"; wx.a(); const lib = require("ui-lib"); my.b();'
const input = { code, filename: 'pages/index.js' }
const summary = {
  requireLiterals: [{ start: code.indexOf('"ui-lib"'), end: code.indexOf('"ui-lib"') + '"ui-lib"'.length, value: 'ui-lib' }],
  platformApiObjects: ['wx', 'my'].map(name => ({ start: code.indexOf(`${name}.`), end: code.indexOf(`${name}.`) + name.length })),
}

describe('experimental native chunk summary adapter', () => {
  it.each([false, true])('preserves exact production code and sourcemaps (inline=%s)', (inline) => {
    const expected = rewriteWithProduction([createChunk(input, inline)], options)[0]
    const actual = rewriteChunkFromSummary(createChunk(input, inline), summary, options)
    expect(actual.code).toBe(expected!.code)
    expect(JSON.parse(JSON.stringify(actual.map))).toEqual(JSON.parse(JSON.stringify(expected!.map)))
  })

  it('calls the binding once for a batch', () => {
    const analyzeChunkRewritesNative = vi.fn(() => [summary, summary])
    const result = rewriteWithNative([createChunk(input), createChunk({ ...input, filename: 'pages/other.js' })], { analyzeChunkRewritesNative }, options)
    expect(analyzeChunkRewritesNative).toHaveBeenCalledTimes(1)
    expect(result.fallback).toBeUndefined()
    expect(result.chunks).toHaveLength(2)
  })

  it('shares the production text prefilter for escaped-only identifiers', () => {
    const inputs = [String.raw`w\u0078.a()`, String.raw`r\u0065quire("ui-lib")`].map((code, index) => ({ code, filename: `escaped-${index}.js` }))
    const analyzeChunkRewritesNative = vi.fn(() => [])
    const expected = rewriteWithProduction(inputs.map(input => createChunk(input)), options)
    const actual = rewriteWithNative(inputs.map(input => createChunk(input)), { analyzeChunkRewritesNative }, options)
    expect(analyzeChunkRewritesNative).not.toHaveBeenCalled()
    expect(actual.skippedInputs).toBe(2)
    expect(actual.chunks.map(chunk => chunk.code)).toEqual(expected.map(chunk => chunk.code))
  })

  it('preserves lone UTF-16 surrogates without crossing the native boundary', () => {
    const analyzeChunkRewritesNative = vi.fn(() => [])
    const malformedUnicode = { filename: 'unicode.js', code: 'const label = "\uD800"; require("ui-lib"); wx.a()' }
    const expected = rewriteWithProduction([createChunk(malformedUnicode)], options)
    const actual = rewriteWithNative([createChunk(malformedUnicode)], { analyzeChunkRewritesNative }, options)
    expect(analyzeChunkRewritesNative).not.toHaveBeenCalled()
    expect(actual.fallback).toContain('UTF-16')
    expect(actual.chunks[0]!.code).toBe(expected[0]!.code)
  })

  it.each(['throw', 'missing', 'overlap', 'outside', 'value'])('falls back before any chunk changes for %s', (failure) => {
    const malformed = {
      ...summary,
      platformApiObjects: failure === 'overlap' ? [...summary.platformApiObjects, ...summary.platformApiObjects] : [{ start: code.length, end: code.length + 2 }],
    }
    const analyzeChunkRewritesNative = () => {
      if (failure === 'throw') {
        throw new Error('native unavailable')
      }
      return failure === 'missing'
        ? [summary]
        : [summary, failure === 'value'
            ? {
                ...summary,
                requireLiterals: [{ ...summary.requireLiterals[0]!, value: undefined as unknown as string }],
              }
            : malformed]
    }
    const inputs = [input, { ...input, filename: 'pages/other.js' }]
    const expected = rewriteWithProduction(inputs.map(value => createChunk(value)), options)
    const actual = rewriteWithNative(inputs.map(value => createChunk(value)), { analyzeChunkRewritesNative }, options)
    expect(actual.fallback).toBeDefined()
    expect(actual.chunks.map(chunk => chunk.code)).toEqual(expected.map(chunk => chunk.code))
    expect(actual.chunks.map(chunk => JSON.stringify(chunk.map))).toEqual(expected.map(chunk => JSON.stringify(chunk.map)))
  })
})
