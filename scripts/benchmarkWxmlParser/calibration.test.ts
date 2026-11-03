import { describe, expect, it } from 'vitest'
import { calibrateBatch, CALIBRATION_POLICY } from './calibration'

describe('common parser batch calibration', () => {
  it('expands both future arms when a fast candidate falls below the observed clock granularity', () => {
    const result = calibrateBatch((arm, iterations) => {
      if (arm === 'baseline') {
        return 1
      }
      return iterations === 50 ? 0 : iterations === 500 ? 0.01 : 0.1
    }, true)
    expect(result.iterations).toBe(5000)
    expect(result.candidateResolved).toBe(true)
    expect(result.probes).toEqual([
      { arm: 'baseline', iterations: 1, durationMs: 1 },
      { arm: 'candidate', iterations: 50, durationMs: 0 },
      { arm: 'candidate', iterations: 500, durationMs: 0.01 },
      { arm: 'candidate', iterations: 5000, durationMs: 0.1 },
    ])
  })

  it('keeps real zero probes and reports unresolved timing at the fixed upper bound', () => {
    const result = calibrateBatch(arm => arm === 'baseline' ? 1 : 0, true)
    expect(result.iterations).toBe(CALIBRATION_POLICY.maximumIterations)
    expect(result.candidateResolved).toBe(false)
    expect(result.probes.filter(probe => probe.arm === 'candidate').every(probe => probe.durationMs === 0)).toBe(true)
  })
})
