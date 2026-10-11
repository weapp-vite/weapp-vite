import { describe, expect, it } from 'vitest'
import { readHmrProfileLines } from './reader'

const enumFields = [
  { field: 'pipeline', values: ['standard', 'stateful'] },
  { field: 'profileMode', values: ['delivery', 'full', 'refresh'] },
  { field: 'completionBoundary', values: ['delivery-acknowledged', 'output-published'] },
  { field: 'event', values: ['update', 'create', 'delete'] },
]

function createSample(field: string, value: unknown) {
  return {
    schemaVersion: 1,
    status: 'complete',
    totalMs: 10,
    ...(field === 'event'
      ? { sourceEvents: [{ eventId: 'event-1', event: value, receivedAtMs: 1 }] }
      : { [field]: value }),
  }
}

describe.each(enumFields)('HMR profile enum $field', ({ field, values }) => {
  it.each(values)('accepts the string %s without changing it', (value) => {
    const sample = createSample(field, value)
    const result = readHmrProfileLines(JSON.stringify(sample))
    expect(result.samples).toEqual([sample])
    expect(result.coverage).toEqual({ legacy: 0, compatible: 1, incompatible: 0, incomplete: 0, invalid: 0 })
    expect(result.skippedLineCount).toBe(0)
  })

  it('keeps the field optional for current and legacy records', () => {
    const sample = createSample(field, undefined)
    const { schemaVersion: _schemaVersion, status: _status, ...legacy } = sample
    const result = readHmrProfileLines([sample, legacy].map(value => JSON.stringify(value)).join('\n'))
    expect(result.samples).toEqual([sample, legacy])
    expect(result.coverage).toEqual({ legacy: 1, compatible: 1, incompatible: 0, incomplete: 0, invalid: 0 })
    expect(result.skippedLineCount).toBe(0)
  })

  it.each([null, true, false, 0, {}, { toString: null }, [values[0]], [[values[0]]]].map(value => ({ value })))('skips a non-string value %j', ({ value }) => {
    const result = readHmrProfileLines(JSON.stringify(createSample(field, value)))
    expect(result.samples).toEqual([])
    expect(result.coverage).toEqual({ legacy: 0, compatible: 0, incompatible: 0, incomplete: 0, invalid: 1 })
    expect(result.skippedLineCount).toBe(1)
  })
})
