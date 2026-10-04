import type { TransformResult } from '../../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/utils'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { serializeCaptureValue } from './captureSerialize'
import { loadScriptTransformer, validateNativeTransformOutcome, withTransformScriptFallback } from './transformNative'

const binding = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('node:module', async importOriginal => ({
  ...await importOriginal<typeof import('node:module')>(),
  createRequire: () => () => ({ transformScriptNative: binding.invoke }),
}))

const source = 'export default { setup() {} }'
const request = (options: object | undefined = {}) => JSON.stringify({ schemaVersion: 1, options: serializeCaptureValue(options), contract: {} })
const map = () => ({ version: 3, sources: ['inline.ts'], sourcesContent: [source], names: [], mappings: 'AAAA' })
const value = (): TransformResult => ({ code: 'compiled', transformed: true, map: map() })
const ok = (result: unknown = value()) => ({ status: 'ok', resultJson: JSON.stringify(result), warnings: [] as string[], diagnostics: [], omittedUndefined: [] as string[] })
const unsupported = () => ({ status: 'unsupported', unsupportedReason: 'Deferred syntax', warnings: [], diagnostics: [], omittedUndefined: [] })

describe('whole-stage native result validation', () => {
  it('keeps all successful metadata and original serialized evidence', () => {
    const result = { ...value(), runtimeCapabilities: { required: ['templateRefs', 'layout'], conservative: ['layout'] }, componentStyleOptions: { styleIsolation: { kind: 'known', value: 'shared' }, addGlobalClass: { kind: 'absent' } } }
    const output = ok(result)
    output.warnings = ['notice']
    const verified = validateNativeTransformOutcome(output, source, request())
    expect(verified).toMatchObject({ status: 'ok', result, resultJson: JSON.stringify(result), warnings: ['notice'], diagnostics: [], omittedUndefined: [] })
  })

  it('honors sourceMap:false and allows an unchanged result without a map', () => {
    expect(validateNativeTransformOutcome(ok({ code: 'compiled', transformed: true, map: null }), source, request({ sourceMap: false })).status).toBe('ok')
    expect(() => validateNativeTransformOutcome(ok(), source, request({ sourceMap: false }))).toThrow('sourceMap:false')
    expect(validateNativeTransformOutcome(ok({ code: source, transformed: false }), source, request()).status).toBe('ok')
    expect(() => validateNativeTransformOutcome(ok({ code: 'changed', transformed: false }), source, request())).toThrow('transformed state')
  })

  it('requires exact omitted-undefined provenance, including top-level absent options', () => {
    const output = ok()
    output.omittedUndefined = ['$.sourceMap', '$.classStyleBindings.0.conditions']
    expect(validateNativeTransformOutcome(output, source, request({ sourceMap: undefined, classStyleBindings: [{ conditions: undefined }] })).status).toBe('ok')
    output.omittedUndefined.reverse()
    expect(() => validateNativeTransformOutcome(output, source, request({ sourceMap: undefined, classStyleBindings: [{ conditions: undefined }] }))).toThrow('omittedUndefined')
    expect(validateNativeTransformOutcome({ ...ok(), omittedUndefined: ['$'] }, source, JSON.stringify({ schemaVersion: 1, options: { kind: 'undefined' }, contract: {} })).status).toBe('ok')
  })

  it.each([
    ['missing outcome', undefined],
    ['unknown status', { ...ok(), status: 'maybe' }],
    ['invalid JSON', { ...ok(), resultJson: 'invalid' }],
    ['missing code', ok({ transformed: true, map: map() })],
    ['invalid code', ok({ ...value(), code: 1 })],
    ['missing transformed', ok({ code: 'compiled', map: map() })],
    ['unknown result key', ok({ ...value(), stale: true })],
    ['missing requested map', ok({ code: 'compiled', transformed: true })],
    ['invalid map version', ok({ ...value(), map: { ...map(), version: 2 } })],
    ['map source mismatch', ok({ ...value(), map: { ...map(), sourcesContent: ['another source'] } })],
    ['map file mismatch', ok({ ...value(), map: { ...map(), sources: ['another.ts'] } })],
    ['map names mismatch', ok({ ...value(), map: { ...map(), names: [1] } })],
    ['unknown capability', ok({ ...value(), runtimeCapabilities: { required: ['unknown'] } })],
    ['duplicate capability', ok({ ...value(), runtimeCapabilities: { required: ['layout', 'layout'] } })],
    ['missing capability dependency', ok({ ...value(), runtimeCapabilities: { required: ['layout'] } })],
    ['invalid conservative subset', ok({ ...value(), runtimeCapabilities: { required: ['templateRefs'], conservative: ['layout'] } })],
    ['incomplete style', ok({ ...value(), componentStyleOptions: { styleIsolation: { kind: 'absent' } } })],
    ['missing known style value', ok({ ...value(), componentStyleOptions: { styleIsolation: { kind: 'known' }, addGlobalClass: { kind: 'absent' } } })],
    ['stale absent style value', ok({ ...value(), componentStyleOptions: { styleIsolation: { kind: 'absent', value: true }, addGlobalClass: { kind: 'absent' } } })],
    ['unexpected omission', { ...ok(), omittedUndefined: ['$.ghost'] }],
    ['stale success reason', { ...ok(), unsupportedReason: 'stale error' }],
    ['failure partial result', { ...unsupported(), resultJson: JSON.stringify(value()) }],
    ['failure partial warning', { ...unsupported(), warnings: ['not committed'] }],
    ['failure partial omission', { ...unsupported(), omittedUndefined: ['$.isPage'] }],
    ['wrong unsupported reason', { ...unsupported(), unsupportedReason: 1 }],
    ['empty parse diagnostics', { ...unsupported(), status: 'parse-error', unsupportedReason: undefined }],
  ])('rejects %s', (_label, output) => {
    expect(() => validateNativeTransformOutcome(output, source, request())).toThrow()
  })

  it.each(['parse-error', 'semantic-error'])('accepts complete %s UTF-16 diagnostics without output', (status) => {
    const output = { status, warnings: [], omittedUndefined: [], diagnostics: [{ message: 'error', labels: [{ start: 0, end: 2 }] }] }
    expect(validateNativeTransformOutcome(output, '😀', request()).status).toBe(status)
    output.diagnostics[0].labels[0].end = 3
    expect(() => validateNativeTransformOutcome(output, '😀', request())).toThrow('UTF-16')
  })

  it('rejects unsupported request versions and invalid sourceMap flags even for a success response', () => {
    expect(() => validateNativeTransformOutcome(ok(), source, JSON.stringify({ schemaVersion: 2 }))).toThrow('request version')
    expect(() => validateNativeTransformOutcome(ok(), source, request({ sourceMap: 'false' }))).toThrow('sourceMap request option')
  })

  it('refuses non-explicit binding paths before attempting to load', async () => {
    await expect(loadScriptTransformer('relative.node')).rejects.toThrow('absolute experimental .node')
  })

  it.each([false, true])('observes malformed native evidence before validation, observer throws: %s', async (throws) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'native-transform-observer-'))
    try {
      const filename = path.join(directory, 'fake.node')
      await writeFile(filename, 'synthetic binding identity')
      const malformed = { status: 'ok', resultJson: 'invalid', warnings: ['partial'] }
      binding.invoke.mockReset().mockReturnValue(malformed)
      const transformer = await loadScriptTransformer(filename)
      const observerError = new Error('observer failure')
      const observeRaw = vi.fn((raw: unknown) => {
        expect(raw).toBe(malformed)
        if (throws) {
          throw observerError
        }
      })
      expect(() => transformer.transform(source, request(), observeRaw)).toThrow(throws ? observerError : 'Invalid native script outcome')
      expect(binding.invoke).toHaveBeenCalledExactlyOnceWith(source, request())
      expect(observeRaw).toHaveBeenCalledExactlyOnceWith(malformed)
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})

describe('whole-stage JavaScript fallback and warning ownership', () => {
  it('invokes native once and publishes successful warnings in order after full validation', () => {
    const invoke = vi.fn(() => ({ ...ok(), warnings: ['first', 'second'] }))
    const fallback = vi.fn(value)
    const warn = vi.fn()
    expect(withTransformScriptFallback({ invoke, source, request: request(), fallback, warn })).toEqual(value())
    expect(invoke).toHaveBeenCalledExactlyOnceWith(source, request())
    expect(fallback).not.toHaveBeenCalled()
    expect(warn.mock.calls).toEqual([['first'], ['second']])
    expect(warn.mock.contexts).toEqual([undefined, undefined])
  })

  it.each(['unsupported', 'throw', 'bad-payload'] as const)('falls back exactly once for %s without replaying partial native warnings', (mode) => {
    const warn = vi.fn()
    const original = { code: 'original JS result', transformed: true, map: null }
    const fallback = vi.fn(() => {
      warn('JS warning')
      return original
    })
    const invoke = vi.fn(() => {
      if (mode === 'throw') {
        throw new Error('Native execution failure')
      }
      return mode === 'unsupported' ? unsupported() : { ...ok({ code: 'partial' }), warnings: ['partial native warning'] }
    })
    const actual = withTransformScriptFallback({ invoke, source, request: request(), fallback, warn })
    expect(actual).toBe(original)
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(fallback).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledExactlyOnceWith('JS warning')
  })

  it('does not execute the fallback a second time when fallback itself throws', () => {
    const error = new Error('JS stage error')
    const fallback = vi.fn(() => {
      throw error
    })
    expect(() => withTransformScriptFallback({ invoke: unsupported, source, request: request(), fallback })).toThrow(error)
    expect(fallback).toHaveBeenCalledTimes(1)
  })

  it('propagates warning delivery errors without falling back or replaying earlier warnings', () => {
    const error = new Error('warn callback failed')
    const warn = vi.fn((message: string) => {
      if (message === 'second') {
        throw error
      }
    })
    const fallback = vi.fn(value)
    expect(() => withTransformScriptFallback({ invoke: () => ({ ...ok(), warnings: ['first', 'second', 'third'] }), source, request: request(), fallback, warn })).toThrow(error)
    expect(warn.mock.calls).toEqual([['first'], ['second']])
    expect(fallback).not.toHaveBeenCalled()
  })

  it('uses the standard console warning channel when no callback is provided', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      withTransformScriptFallback({ invoke: () => ({ ...ok(), warnings: ['default warning'] }), source, request: request(), fallback: value })
      expect(consoleWarn).toHaveBeenCalledExactlyOnceWith('default warning')
    }
    finally {
      consoleWarn.mockRestore()
    }
  })

  it('falls back when native ignores sourceMap:false without publishing its warnings', () => {
    const warn = vi.fn()
    const fallback = vi.fn(() => ({ code: 'JS without map', transformed: true, map: null }))
    const result = withTransformScriptFallback({ invoke: () => ({ ...ok(), warnings: ['rejected warning'] }), source, request: request({ sourceMap: false }), fallback, warn })
    expect(result).toEqual({ code: 'JS without map', transformed: true, map: null })
    expect(fallback).toHaveBeenCalledTimes(1)
    expect(warn).not.toHaveBeenCalled()
  })
})
