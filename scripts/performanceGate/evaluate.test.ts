import { describe, expect, it } from 'vitest'
import { assertGatePassed, evaluateGate, summarizePairs } from './evaluate'

const scenario = (current: number, count = 7) => ({ id: 'native:first-build', requiredPairs: 7, pairs: Array.from({ length: count }, () => ({ baseline: 100, current })) })

describe('paired performance gate', () => {
  it('passes costs within 5% without an absolute-time exemption', () => {
    expect(evaluateGate([scenario(105)]).status).toBe('passed')
    expect(evaluateGate([scenario(106)], [scenario(106)]).status).toBe('regression')
    expect(() => assertGatePassed(evaluateGate([scenario(106)], [scenario(106)]))).toThrow('regression')
  })
  it('does not turn a favorable confirmation into a pass', () => {
    expect(evaluateGate([scenario(110)], [scenario(101)]).status).toBe('unstable')
    expect(evaluateGate([scenario(110)]).status).toBe('incomplete')
    expect(evaluateGate([scenario(110)], [scenario(110, 6)]).status).toBe('incomplete')
  })
  it('rejects empty, missing, invalid, duplicate and failed evidence', () => {
    for (const input of [[], [scenario(100, 6)], [scenario(Number.NaN)], [scenario(100), scenario(100)], [{ ...scenario(100), error: 'baseline cleanup failed' }]]) {
      expect(evaluateGate(input).status).toBe('incomplete')
    }
    expect(evaluateGate([scenario(110)], [scenario(110), scenario(100)]).status).toBe('incomplete')
  })
  it('retains tail samples and paired deltas', () => {
    const pairs = [100, 102, 104, 106, 108, 110, 300].map(current => ({ baseline: 100, current }))
    expect(summarizePairs(pairs)).toMatchObject({ currentMedianMs: 106, currentP95Ms: 300, pairedDeltaMedianMs: 6 })
    expect(pairs).toHaveLength(7)
  })
})
