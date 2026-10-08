import type { TransformScriptCaptureRecord } from './captureTypes'
import type { IntegratedMode, IntegratedRecord } from './integratedTypes'
import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { createCaptureBridgeMetrics, serializeCaptureValue } from './captureSerialize'
import { digest } from './identity'
import { verifyIntegratedCallOwnership, verifyIntegratedRecord } from './integratedChecks'
import { serializeTransformScriptRequest } from './request'

function fixture(mode: IntegratedMode, fallback = false) {
  const source = 'export default { setup() { return { label: "😀" } } }'
  const result = { code: source, transformed: true, map: null }
  const expected: TransformScriptCaptureRecord = {
    schemaVersion: 1,
    scenarioId: 'complete-script',
    callIndex: 0,
    source: { code: source, sha256: digest(source), utf16Length: source.length, utf8Bytes: Buffer.byteLength(source) },
    options: serializeCaptureValue({ sourceMap: false }),
    fastSetup: 'miss',
    status: 'returned',
    result: serializeCaptureValue(result),
    warnings: [],
    bridge: createCaptureBridgeMetrics(),
    captureFailures: [],
  }
  const raw = fallback
    ? { status: 'unsupported', unsupportedReason: 'Unsupported component shape', warnings: [], diagnostics: [], omittedUndefined: [] }
    : { status: 'ok', resultJson: JSON.stringify(result), warnings: [], diagnostics: [], omittedUndefined: [] }
  const record: IntegratedRecord = {
    schemaVersion: 1,
    scenarioId: expected.scenarioId,
    callIndex: 0,
    source: structuredClone(expected.source),
    options: structuredClone(expected.options),
    nativeCalls: mode === 'native' ? 1 : 0,
    fallbackCalls: fallback ? 1 : 0,
    used: mode === 'control-js' ? 'control-js' : fallback ? 'fallback' : 'native',
    status: 'returned',
    result: serializeCaptureValue(result),
    warnings: [],
    bridge: createCaptureBridgeMetrics(),
    evidenceErrors: [],
  }
  if (mode === 'native') {
    record.request = serializeTransformScriptRequest({ kind: 'captured', options: expected.options! })
    record.rawNative = serializeCaptureValue(raw)
    record.nativeStatus = fallback ? 'unsupported' : 'ok'
    if (fallback) {
      record.fallbackReason = 'Unsupported component shape'
    }
  }
  return { expected, record }
}

describe('integrated complete compiler evidence ownership', () => {
  it('rejects moving the second compile stage record into the first compile', () => {
    const { expected, record } = fixture('native')
    const captured = [expected, { ...expected, callIndex: 1 }]
    const records = [record, { ...record, callIndex: 1 }]
    expect(verifyIntegratedCallOwnership([0], records, captured, record.scenarioId, 0)).toEqual([records[0]])
    expect(verifyIntegratedCallOwnership([1], records, captured, record.scenarioId, 1)).toEqual([records[1]])
    for (const indexes of [[0, 1], [], [1], [0, 0]]) {
      expect(() => verifyIntegratedCallOwnership(indexes, records, captured, record.scenarioId, 0)).toThrow()
    }
    expect(() => verifyIntegratedCallOwnership([0], records, captured, record.scenarioId, 1)).toThrow('unowned, duplicated or reordered')
    expect(() => verifyIntegratedCallOwnership([0], records, [expected], record.scenarioId, 0)).toThrow('per-call stage coverage')
  })

  it.each(['control-js', 'native'] as const)('accepts an owned %s result without changing source descriptors', (mode) => {
    const { expected, record } = fixture(mode)
    expect(verifyIntegratedRecord(record, expected, mode)).toBe(record)
  })

  it('accepts an unsupported native request only when the exact JS result is returned once', () => {
    const { expected, record } = fixture('native', true)
    expect(verifyIntegratedRecord(record, expected, 'native').fallbackCalls).toBe(1)
    record.result = serializeCaptureValue({ code: 'partially generated;', transformed: true, map: null })
    expect(() => verifyIntegratedRecord(record, expected, 'native')).toThrow('fallback changed JS results')
  })

  it.each([0, 2])('rejects unsupported outcome with %s JS fallbacks', (fallbackCalls) => {
    const { expected, record } = fixture('native', true)
    record.fallbackCalls = fallbackCalls
    expect(() => verifyIntegratedRecord(record, expected, 'native')).toThrow('exactly one complete JS fallback')
  })

  it('rejects native output that was computed but not delivered to the real compiler', () => {
    const { expected, record } = fixture('native')
    record.result = serializeCaptureValue({ code: 'original JS output;', transformed: true, map: null })
    expect(() => verifyIntegratedRecord(record, expected, 'native')).toThrow('not delivered directly')
  })

  it('rejects request or input drift even when a raw payload looks valid', () => {
    for (const change of [
      (record: IntegratedRecord) => { record.source.utf8Bytes = record.source.utf16Length },
      (record: IntegratedRecord) => { record.options = serializeCaptureValue({ sourceMap: true }) },
      (record: IntegratedRecord) => { record.request = record.request!.replace('false', 'true') },
      (record: IntegratedRecord) => { record.callIndex = 1 },
      (record: IntegratedRecord) => { record.scenarioId = 'another-owner' },
    ]) {
      const { expected, record } = fixture('native')
      change(record)
      expect(() => verifyIntegratedRecord(record, expected, 'native')).toThrow()
    }
  })

  it('rejects partial observation, extra native calls and a control that performs native work', () => {
    for (const change of [
      (record: IntegratedRecord) => { record.nativeCalls = 2 },
      (record: IntegratedRecord) => { record.evidenceErrors.push({ name: 'Error', message: 'Missing raw value' }) },
      (record: IntegratedRecord) => { record.status = 'active' },
      (record: IntegratedRecord) => { record.result = undefined },
    ]) {
      const { expected, record } = fixture('native')
      change(record)
      expect(() => verifyIntegratedRecord(record, expected, 'native')).toThrow()
    }
    const { expected, record } = fixture('control-js')
    record.nativeCalls = 1
    expect(() => verifyIntegratedRecord(record, expected, 'control-js')).toThrow('control invoked native')
  })

  it('retains error and warning contracts for the actual fallback', () => {
    const { expected, record } = fixture('native', true)
    record.warnings.push({ channel: 'handler', arguments: serializeCaptureValue(['extra']) })
    expect(() => verifyIntegratedRecord(record, expected, 'native')).toThrow('fallback changed JS results or warnings')
    record.warnings = []
    expected.status = 'threw'
    record.status = 'threw'
    expected.result = undefined
    record.result = undefined
    expected.error = { name: 'Error', message: 'JS failure' }
    record.error = { name: 'Error', message: 'Different failure' }
    expect(() => verifyIntegratedRecord(record, expected, 'native')).toThrow('fallback changed JS results or warnings')
    record.error = structuredClone(expected.error)
    expect(verifyIntegratedRecord(record, expected, 'native').status).toBe('threw')
  })

  it('rejects malformed or invented native warning observations', () => {
    const valid = fixture('native')
    valid.record.rawNative = serializeCaptureValue({ status: 'ok', resultJson: JSON.stringify({ code: valid.expected.source.code, transformed: true, map: null }), warnings: ['first', 'second'], diagnostics: [], omittedUndefined: [] })
    valid.record.warnings = ['first', 'second'].map(message => ({ channel: 'handler', arguments: serializeCaptureValue([message]) }))
    expect(verifyIntegratedRecord(valid.record, valid.expected, 'native')).toBe(valid.record)
    valid.record.warnings.reverse()
    expect(() => verifyIntegratedRecord(valid.record, valid.expected, 'native')).toThrow('exactly once in order')
    for (const warnings of [
      [123],
      [{ channel: 'unknown', arguments: serializeCaptureValue([]) }],
      [{ channel: 'handler', arguments: serializeCaptureValue('not an argument list') }],
      [{ channel: 'handler', arguments: serializeCaptureValue(['invented']) }],
    ]) {
      const { expected, record } = fixture('native')
      record.warnings = warnings as IntegratedRecord['warnings']
      expect(() => verifyIntegratedRecord(record, expected, 'native')).toThrow()
    }
  })
})
