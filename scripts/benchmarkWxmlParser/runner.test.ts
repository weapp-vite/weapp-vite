import type { Operation, Sample } from './types'
import { describe, expect, it } from 'vitest'
import { classify } from './freeze'
import { assertPassed, statistics, summarize } from './measurement'
import { argumentsFor } from './prepare'

const operation: Operation = { id: 'parse', comparable: true, run: () => undefined }
function samples(current: number, phase: Sample['phase'] = 'primary'): Sample[] {
  return Array.from({ length: 40 }, (_, round) =>
    (['baseline', 'candidate'] as const).map(arm => ({
      operation: 'parse',
      cohort: 'shared',
      round,
      arm,
      phase,
      durationMs: arm === 'baseline' ? 100 : current,
      iterations: 10,
      documents: 50,
      bytes: 1048576,
    }))).flat()
}

describe('WXML benchmark contract', () => {
  it('requires an explicit exploratory or formal mode and new output argument', () => {
    expect(() => argumentsFor([])).toThrow('exactly one')
    expect(() => argumentsFor(['--quick', '--check'])).toThrow('exactly one')
    expect(() => argumentsFor(['--quick', '--output'])).toThrow('directory')
    expect(argumentsFor(['--check', '--browser', '--consumer-scanner', 'adapter.ts#parseWxmlTokens'])).toMatchObject({
      check: true,
      quick: false,
      browser: true,
      consumers: { scanner: 'adapter.ts#parseWxmlTokens' },
    })
  })

  it('does not move ordinary interpolation or many tags out of the shared cohort', () => {
    expect(classify('<view a="{{a}}"><text>{{b}}</text></view>')).toBe('shared')
    expect(classify('<view><text>{{a < b}}</text></view>')).toBe('wxml')
    expect(classify('<wxs module="m">module.exports = "<view>"</wxs>')).toBe('wxml')
    expect(classify('<view title="a\\\"b" />')).toBe('wxml')
  })

  it('reports normalized P50/P95 and byte/document throughput', () => {
    expect(statistics(samples(100).filter(row => row.arm === 'baseline'))).toEqual({
      count: 40,
      p50Ms: 10,
      p95Ms: 10,
      documentsPerSecond: 5000,
      mibPerSecond: 100,
    })
  })

  it('requires aggregate parity speed and exactly one equal-size confirmation', () => {
    expect(summarize(samples(100), operation, 'shared', 40).status).toBe('passed')
    expect(summarize(samples(101), operation, 'shared', 40).status).toBe('incomplete')
    expect(summarize([...samples(101), ...samples(102, 'confirmation')], operation, 'shared', 40).status).toBe('regression')
    expect(summarize([...samples(101), ...samples(99, 'confirmation')], operation, 'shared', 40).status).toBe('unstable')
    const duplicate = samples(99).map(row => ({ ...row, round: 0 }))
    expect(summarize(duplicate, operation, 'shared', 40).status).toBe('incomplete')
    const quantized = samples(0)
    expect(summarize(quantized, { ...operation, comparable: false }, 'shared', 40).status).toBe('informational')
  })

  it('does not accept errors, semantic changes, missing or informational-only work', () => {
    const passed = summarize(samples(99), operation, 'shared', 40)
    expect(() => assertPassed({ samples: [], summaries: [passed], errors: [], parity: [] })).toThrow('manifest')
    expect(() => assertPassed({ samples: [], summaries: [], errors: [], parity: [] })).toThrow()
    expect(() => assertPassed({ samples: [], summaries: [passed], errors: [{ operation: 'parse', fixture: 'fixture', arm: 'candidate', error: 'invalid' }], parity: [] })).toThrow()
    expect(() => assertPassed({ samples: [], summaries: [passed], errors: [], parity: [{ operation: 'parse', fixture: 'fixture', cohort: 'shared', equal: false, baseline: 'a', candidate: 'b' }] })).toThrow()
  })
})
