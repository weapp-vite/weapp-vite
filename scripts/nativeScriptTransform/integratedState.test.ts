import type { TransformResult } from '../../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/utils'
import type { CaptureExpressionTools } from './captureTypes'
import type { IntegratedBinding, IntegratedMode } from './integratedTypes'
import type { InlineProvenance } from './origins/types'
import { describe, expect, it, vi } from 'vitest'
import { decodeCapturedData } from './captureRead'
import { IntegratedTransformState } from './integratedState'

const source = 'export default {}'
const expressions: CaptureExpressionTools = { generate: () => ({ code: 'expression' }), isExpression: () => false }
const nativeResult: TransformResult = { code: 'native()', transformed: true, map: null }
const jsResult: TransformResult = { code: 'original()', transformed: true, map: null }
const ok = () => ({ status: 'ok', resultJson: JSON.stringify(nativeResult), warnings: [], diagnostics: [], omittedUndefined: [] })
const unsupported = () => ({ status: 'unsupported', unsupportedReason: 'Deferred syntax', warnings: [], diagnostics: [], omittedUndefined: [] })
const stateFor = (binding: IntegratedBinding = {}, mode: IntegratedMode = 'native', key?: symbol) => new IntegratedTransformState(mode, binding, () => key)

describe('integrated stage selection and fallback ownership', () => {
  it('passes origins beside untouched options once and preserves the complete map object', async () => {
    const provenance: InlineProvenance = { schemaVersion: 1, coordinateEncoding: 'utf16', sources: [{ id: 'source', filename: 'Page.vue', content: '<template />' }], occurrences: [] }
    const map = { version: 3, sources: ['inline.ts', 'Page.vue'], sourcesContent: [source, '<template />'], names: [], mappings: 'AAAA' }
    const result = { ...nativeResult, map }
    const options = Object.freeze({ sourceMap: true })
    const origins = vi.fn((actual) => {
      expect(actual).toBe(options)
      return provenance
    })
    const invoke = vi.fn((_source: string, request: string) => {
      expect(JSON.parse(request).provenance).toEqual(provenance)
      return { ...ok(), resultJson: JSON.stringify(result) }
    })
    const state = new IntegratedTransformState('native', { invoke }, () => undefined, origins)
    const fallback = vi.fn(() => jsResult)
    const { value, records } = await state.run('origins', () => state.invoke(source, options, fallback, expressions, () => vi.fn()))
    expect(value).toEqual(result)
    expect(origins).toHaveBeenCalledTimes(1)
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(fallback).not.toHaveBeenCalled()
    expect(records[0]!.provenance).toEqual(provenance)
    expect(decodeCapturedData(records[0]!.options!)).toEqual({ sourceMap: true })
    const select = vi.fn(() => null)
    state.maps.compose(value.map, null, () => null, select)
    expect(select).toHaveBeenCalledExactlyOnceWith(value.map, null, 'inline.ts')
  })

  it('returns the complete control result by identity without native or fallback', async () => {
    const invoke = vi.fn(ok)
    const state = stateFor({ invoke }, 'control-js')
    const original = vi.fn(() => jsResult)
    const resolveWarn = vi.fn(() => vi.fn())
    const { value, records } = await state.run('control', () => state.invoke(source, {}, original, expressions, resolveWarn))
    expect(value).toBe(jsResult)
    expect(original).toHaveBeenCalledTimes(1)
    expect(invoke).not.toHaveBeenCalled()
    expect(resolveWarn).not.toHaveBeenCalled()
    expect(records[0]).toMatchObject({ used: 'control-js', fallbackCalls: 0, nativeCalls: 0, status: 'returned', evidenceErrors: [] })
    expect(decodeCapturedData(records[0]!.result!)).toEqual(jsResult)
  })

  it('passes a complete valid native map onward without substituting the JS result', async () => {
    const map = { version: 3, sources: ['inline.ts'], sourcesContent: [source], names: [], mappings: 'AAAA' }
    const result = { ...nativeResult, map, runtimeCapabilities: { required: ['templateRefs'] } }
    const invoke = vi.fn(() => ({ ...ok(), resultJson: JSON.stringify(result) }))
    const state = stateFor({ invoke })
    const original = vi.fn(() => jsResult)
    const { value, records } = await state.run('native', () => state.invoke(source, {}, original, expressions, () => vi.fn()))
    expect(value).toEqual(result)
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(original).not.toHaveBeenCalled()
    expect(records[0]).toMatchObject({ used: 'native', nativeStatus: 'ok', fallbackCalls: 0, nativeCalls: 1, status: 'returned', evidenceErrors: [] })
    expect(decodeCapturedData(records[0]!.rawNative!)).toEqual({ ...ok(), resultJson: JSON.stringify(result) })
    expect(decodeCapturedData(records[0]!.result!)).toEqual(result)
  })

  it.each(['load', 'throw', 'unsupported', 'parse-error', 'semantic-error', 'invalid', 'invalid-map'] as const)('actually executes JS once for %s and never publishes partial native warnings', async (mode) => {
    const binding: IntegratedBinding = mode === 'load'
      ? { loadError: { name: 'Error', message: 'Cannot load experimental binding' } }
      : { invoke: vi.fn(() => {
          if (mode === 'throw') {
            throw new Error('Native failed')
          }
          if (mode === 'unsupported') {
            return unsupported()
          }
          if (mode === 'parse-error' || mode === 'semantic-error') {
            return { status: mode, warnings: [], diagnostics: [{ message: 'parse failed', labels: [{ start: 0, end: 1 }] }], omittedUndefined: [] }
          }
          return { ...ok(), resultJson: JSON.stringify(mode === 'invalid' ? { code: 'partial' } : { ...nativeResult, map: { version: 2 } }), warnings: ['rejected native warning'] }
        }) }
    const state = stateFor(binding)
    const warn = vi.fn()
    const original = vi.fn(() => {
      state.warningHandler(warn)('JS warning')
      return jsResult
    })
    const { value, records } = await state.run(mode, () => state.invoke(source, { sourceMap: false, warn }, original, expressions, () => warn))
    expect(value).toBe(jsResult)
    expect(original).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledExactlyOnceWith('JS warning')
    expect(records[0]).toMatchObject({ used: 'fallback', fallbackCalls: 1, nativeCalls: mode === 'load' ? 0 : 1, status: 'returned', evidenceErrors: [] })
    expect(records[0]!.fallbackReason).toBeTruthy()
    expect(records[0]!.warnings.map(warning => decodeCapturedData(warning.arguments))).toEqual([['JS warning']])
    if (mode === 'invalid-map') {
      expect(decodeCapturedData(records[0]!.rawNative!)).toMatchObject({ resultJson: JSON.stringify({ ...nativeResult, map: { version: 2 } }) })
    }
  })

  it('retains the original AST token for the actual JS fallback owner', async () => {
    const key = Symbol('owned AST')
    const token = { take: vi.fn() }
    const options = { sourceMap: false, [key]: token }
    const state = stateFor({ invoke: unsupported }, 'native', key)
    const original = vi.fn(() => {
      expect(options[key]).toBe(token)
      expect(token.take).not.toHaveBeenCalled()
      token.take()
      return jsResult
    })
    const { records } = await state.run('ownership', () => state.invoke(source, options, original, expressions, () => vi.fn()))
    expect(token.take).toHaveBeenCalledTimes(1)
    expect(records[0]!.request).toContain('existing baseline loader; never consumed')
  })

  it('falls back once if request serialization rejects an unknown option', async () => {
    const invoke = vi.fn(ok)
    const state = stateFor({ invoke })
    const original = vi.fn(() => jsResult)
    const { value, records } = await state.run('request', () => state.invoke(source, { unexpected: true }, original, expressions, () => vi.fn()))
    expect(value).toBe(jsResult)
    expect(original).toHaveBeenCalledTimes(1)
    expect(invoke).not.toHaveBeenCalled()
    expect(records[0]).toMatchObject({ used: 'fallback', fallbackCalls: 1, nativeCalls: 0, requestError: { name: 'TypeError' } })
  })

  it('propagates JS fallback errors without retrying and permits the next scenario', async () => {
    const state = stateFor({ invoke: unsupported })
    const error = new Error('Original parser rejected source')
    const original = vi.fn(() => {
      throw error
    })
    await expect(state.run('invalid', () => state.invoke(source, {}, original, expressions, () => vi.fn()))).rejects.toBe(error)
    expect(original).toHaveBeenCalledTimes(1)
    expect(state.snapshot()[0]).toMatchObject({ status: 'threw', fallbackCalls: 1, error: { message: error.message } })
    await state.run('next', () => state.invoke(source, {}, () => jsResult, expressions, () => vi.fn()))
    expect(state.snapshot()[1]).toMatchObject({ scenarioId: 'next', status: 'returned' })
  })
})

describe('integrated warnings, capture and lifecycle', () => {
  it('delivers native warnings once, in order, with unbound callback ownership', async () => {
    const state = stateFor({ invoke: () => ({ ...ok(), warnings: ['first', 'second'] }) })
    const warn = vi.fn()
    const resolveWarn = vi.fn(() => warn)
    const original = vi.fn(() => jsResult)
    const { records } = await state.run('warn', () => state.invoke(source, { sourceMap: false, warn }, original, expressions, resolveWarn))
    expect(warn.mock.calls).toEqual([['first'], ['second']])
    expect(warn.mock.contexts).toEqual([undefined, undefined])
    expect(original).not.toHaveBeenCalled()
    expect(resolveWarn).toHaveBeenCalledTimes(1)
    expect(records[0]!.warnings.map(warning => decodeCapturedData(warning.arguments))).toEqual([['first'], ['second']])
  })

  it('preserves handler and console observations without delivering default warnings twice', async () => {
    const state = stateFor({ invoke: () => ({ ...ok(), warnings: ['default warning'] }) })
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const warn = (message: string) => console.warn(message)
      const { records } = await state.run('console', () => state.invoke(source, { sourceMap: false }, () => jsResult, expressions, () => warn))
      expect(consoleWarn).toHaveBeenCalledExactlyOnceWith('default warning')
      expect(records[0]!.warnings.map(warning => warning.channel)).toEqual(['handler', 'console'])
    }
    finally {
      consoleWarn.mockRestore()
    }
  })

  it('does not fall back after a successful native warning callback throws', async () => {
    const state = stateFor({ invoke: () => ({ ...ok(), warnings: ['first', 'second', 'third'] }) })
    const error = new Error('warning delivery failed')
    const warn = vi.fn((message: string) => {
      if (message === 'second') {
        throw error
      }
    })
    const original = vi.fn(() => jsResult)
    await expect(state.run('warn-error', () => state.invoke(source, { sourceMap: false, warn }, original, expressions, () => warn))).rejects.toBe(error)
    expect(warn.mock.calls).toEqual([['first'], ['second']])
    expect(original).not.toHaveBeenCalled()
    expect(state.snapshot()[0]).toMatchObject({ used: 'native', nativeStatus: 'ok', fallbackCalls: 0, status: 'threw' })
  })

  it('keeps evidence failures visible without changing a control compiler result', async () => {
    const origins = vi.fn(() => undefined)
    const state = new IntegratedTransformState('control-js', {}, () => undefined, origins)
    const options = { get sourceMap() {
      throw new Error('must not evaluate')
    } }
    const { value, records } = await state.run('capture', () => state.invoke(source, options, () => jsResult, expressions, () => vi.fn()))
    expect(value).toBe(jsResult)
    expect(records[0]!.evidenceErrors).toEqual([expect.objectContaining({ message: expect.stringContaining('accessor') })])
    expect(origins).not.toHaveBeenCalled()
  })

  it('rejects overlapping scenarios and active disposal, while disposal stays idempotent', async () => {
    const state = stateFor({}, 'control-js')
    await state.run('active', async () => {
      expect(() => state.dispose()).toThrow('idle')
      await expect(state.run('nested', () => jsResult)).rejects.toThrow('idle')
      state.invoke(source, {}, () => jsResult, expressions, () => vi.fn())
    })
    state.dispose()
    state.dispose()
    await expect(state.run('disposed', () => jsResult)).rejects.toThrow('active owner')
  })
})
