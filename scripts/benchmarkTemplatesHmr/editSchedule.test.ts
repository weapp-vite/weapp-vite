import { describe, expect, it } from 'vitest'
import { createBenchmarkEditSchedule } from './editSchedule'

describe('benchmark edit scheduling', () => {
  it('keeps the historical schedule unless explicitly selected', () => {
    expect(createBenchmarkEditSchedule(20, 120)).toEqual(Array.from({ length: 20 }).fill(0))
  })

  it('uses the same deterministic full-period strata on both checkouts', () => {
    const seed = 'wxml-20261103-phase-v1:native-template'
    const baseline = createBenchmarkEditSchedule(20, 120, seed)
    const candidate = createBenchmarkEditSchedule(20, 120, seed)
    expect(candidate).toEqual(baseline)
    expect([...candidate].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, index) => index * 6 + 3))
    expect(candidate).not.toEqual([...candidate].sort((a, b) => a - b))
    expect(createBenchmarkEditSchedule(20, 120, `${seed}:other`)).not.toEqual(candidate)
  })

  it.each([[0, 120], [20, 0], [1.5, 120], [20, Number.NaN]])('rejects an invalid workload or period: %s / %s', (count, span) => {
    expect(() => createBenchmarkEditSchedule(count, span, 'seed')).toThrow('positive integer')
  })
})
