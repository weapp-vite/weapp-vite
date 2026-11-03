import type { Fixture, Operation } from './types'
import { describe, expect, it, vi } from 'vitest'
import { CORE_OPERATIONS } from './contracts'
import { assertIntegrity, measure } from './measurement'

const real: Fixture = { id: 'real', sha256: 'real', bytes: 7, origins: ['real.wxml'], source: '<view/>', platform: 'weapp', cohort: 'shared', size: 'small' }
const stress: Fixture = { ...real, id: 'stress', sha256: 'stress', synthetic: true, pressureId: 'stress-deep-tree-2048' }

describe('WXML benchmark failure evidence', () => {
  it.each([
    ['preflight', 1, 'shared'],
    ['warmup', 2, 'shared'],
    ['calibration', 3, 'shared'],
    ['primary', 4, 'shared'],
    ['confirmation', 7, 'shared'],
  ] as const)('records %s failures and keeps later cells', async (phase, failureCall, cohort) => {
    let clock = 0
    let baselineCalls = 0
    const now = vi.spyOn(performance, 'now').mockImplementation(() => clock)
    const operations: Operation[] = CORE_OPERATIONS.map(id => ({
      id,
      comparable: id !== 'preserve-noop',
      run: (fixture, arm) => {
        clock += arm === 'baseline' ? 100 : 200
        if (id === 'canonical' && fixture.id === 'real' && arm === 'baseline' && ++baselineCalls === failureCall) {
          throw new RangeError('simulated serializer stack exhaustion')
        }
      },
      verify: () => ({ equal: true, baseline: 'same', candidate: 'same' }),
    }))
    try {
      const result = await measure(operations, [real, stress], true)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toMatchObject({ operation: 'canonical', fixture: 'real', cohort, arm: 'baseline', phase, error: 'RangeError: simulated serializer stack exhaustion' })
      expect(result.summaries).toHaveLength(20)
      expect(result.samples.some(row => row.operation === 'canonical' && row.cohort === stress.pressureId)).toBe(true)
      expect(result.samples.some(row => row.operation === 'preserve-noop' && row.cohort === 'shared')).toBe(true)
      expect(result.summaries.find(row => row.operation === 'canonical' && row.cohort === cohort)!.status).toBe('incomplete')
      expect(() => assertIntegrity(result)).toThrow('operation errors')
    }
    finally {
      now.mockRestore()
    }
  })

  it('calibrates fast exploratory operations into equal batches instead of timing one pass', async () => {
    let clock = 0
    const now = vi.spyOn(performance, 'now').mockImplementation(() => clock)
    const operations: Operation[] = CORE_OPERATIONS.map(id => ({
      id,
      comparable: id !== 'preserve-noop',
      run: (_fixture, arm) => {
        clock += arm === 'baseline' ? 0.5 : 0.25
      },
      verify: () => ({ equal: true, baseline: 'same', candidate: 'same' }),
    }))
    try {
      const result = await measure(operations, [real], true)
      expect(result.manifest).toMatchObject({ warmup: 1, rounds: 3 })
      expect(result.samples.every(sample => sample.iterations === 100 && sample.durationMs > 0)).toBe(true)
      expect(result.samples.filter(sample => sample.arm === 'baseline').every(sample => sample.durationMs >= 50)).toBe(true)
      expect(() => assertIntegrity(result)).not.toThrow()
    }
    finally {
      now.mockRestore()
    }
  })

  it('uses the expanded common count for both arms under a quantized clock', async () => {
    let clock = 0
    const now = vi.spyOn(performance, 'now').mockImplementation(() => Math.floor(clock * 100) / 100)
    const operations: Operation[] = CORE_OPERATIONS.map(id => ({
      id,
      comparable: id !== 'preserve-noop',
      run: (_fixture, arm) => {
        clock += arm === 'baseline' ? 1 : 0.00002
      },
      verify: () => ({ equal: true, baseline: 'same', candidate: 'same' }),
    }))
    try {
      const result = await measure(operations, [real], true)
      const comparable = result.samples.filter(sample => sample.operation !== 'preserve-noop')
      expect(result.calibrations!.some(cell => cell.probes.some(probe => probe.arm === 'candidate' && probe.durationMs === 0))).toBe(true)
      expect(comparable.every(sample => sample.iterations > 50 && sample.iterations <= 10000 && sample.durationMs > 0)).toBe(true)
      for (const cell of result.calibrations!) {
        const rows = result.samples.filter(sample => sample.operation === cell.operation && sample.cohort === cell.cohort)
        expect(rows.every(row => row.iterations === cell.iterations)).toBe(true)
      }
      expect(() => assertIntegrity(result)).not.toThrow()
    }
    finally {
      now.mockRestore()
    }
  })

  it('independently times real-all with every real input and leaves WXML oracle differences intact', async () => {
    const wxml: Fixture = { ...real, id: 'wxml', sha256: 'wxml', cohort: 'wxml' }
    const visits: string[] = []
    let clock = 0
    const now = vi.spyOn(performance, 'now').mockImplementation(() => clock)
    const operations: Operation[] = CORE_OPERATIONS.map(id => ({
      id,
      comparable: id !== 'preserve-noop',
      run: (fixture, arm) => {
        visits.push(`${id}:${arm}:${fixture.id}`)
        clock += 100
      },
      verify: fixture => ({ equal: fixture.cohort !== 'wxml', baseline: 'old', candidate: fixture.cohort === 'wxml' ? 'new' : 'old' }),
    }))
    try {
      const result = await measure(operations, [real, wxml, stress], true)
      expect(result.manifest!.cohorts.at(-1)).toEqual({ id: 'real-all', fixtureIds: ['real', 'wxml'], documents: 2, bytes: 14 })
      const aggregate = result.samples.filter(row => row.operation === 'scan' && row.cohort === 'real-all')
      expect(aggregate).toHaveLength(6)
      expect(aggregate.every(row => row.durationMs === 200 && row.iterations === 1 && row.documents === 2 && row.bytes === 14)).toBe(true)
      expect(visits.slice(-12)).toEqual(Array.from({ length: 3 }, (_, round) => (round % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']).flatMap(arm => [`preserve-noop:${arm}:real`, `preserve-noop:${arm}:wxml`])).flat())
      expect(result.parity).toHaveLength(15)
      expect(result.parity.filter(row => row.fixture === 'wxml')).toHaveLength(5)
      expect(result.parity.filter(row => row.fixture === 'wxml').every(row => !row.equal && row.baseline === 'old' && row.candidate === 'new')).toBe(true)
      expect(() => assertIntegrity(result)).toThrow('semantic')
      const preserve = result.parity.find(row => row.operation === 'preserve-noop' && row.fixture === 'wxml')!
      Object.assign(preserve, { equal: true, baseline: 'same', candidate: 'same' })
      expect(() => assertIntegrity(result)).not.toThrow()
    }
    finally {
      now.mockRestore()
    }
  })
})
