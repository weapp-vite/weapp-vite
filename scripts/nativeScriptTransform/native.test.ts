import { describe, expect, it } from 'vitest'
import { validatePrinterResult } from './native'

const ok = { status: 'ok', code: 'x;', map: '{}', parseDiagnostics: [], semanticDiagnostics: [] }
describe('experimental script printer boundary', () => {
  it('requires a complete success payload without stale errors', () => {
    expect(validatePrinterResult(ok, 'x')).toEqual(ok)
    expect(() => validatePrinterResult({ ...ok, map: undefined }, 'x')).toThrow()
    expect(() => validatePrinterResult({ ...ok, parseDiagnostics: [{ message: 'error', labels: [] }] }, 'x')).toThrow()
  })
  it('requires a textual unsupported reason without contaminating diagnostics', () => {
    const unsupported = { status: 'unsupported-source-type', unsupportedReason: 'TS is unsupported', parseDiagnostics: [], semanticDiagnostics: [] }
    expect(validatePrinterResult(unsupported, '').status).toBe('unsupported-source-type')
    expect(() => validatePrinterResult({ ...unsupported, unsupportedReason: 1 }, '')).toThrow()
    expect(() => validatePrinterResult({ status: 'semantic-error', unsupportedReason: 'stale', parseDiagnostics: [], semanticDiagnostics: [{ message: 'duplicate', labels: [] }] }, '')).toThrow()
  })

  it('rejects failed partial output and out-of-range UTF-16 diagnostics', () => {
    const failed = { status: 'parse-error', parseDiagnostics: [{ message: 'error', labels: [{ start: 0, end: 2 }] }], semanticDiagnostics: [] }
    expect(validatePrinterResult(failed, '😀').status).toBe('parse-error')
    expect(() => validatePrinterResult(failed, 'x')).toThrow('UTF-16')
    expect(() => validatePrinterResult({ ...failed, code: 'x' }, '😀')).toThrow('failed')
    expect(() => validatePrinterResult({ ...failed, parseDiagnostics: [] }, '😀')).toThrow('failed')
  })
})
