import type { Fixture, Operation } from './types'
import { describe, expect, it } from 'vitest'
import { CORE_OPERATIONS } from './contracts'
import { checkCorrectness } from './correctness'

describe('complete untimed correctness preflight', () => {
  it('checks both arms and every oracle after an earlier error without taking samples', () => {
    const fixtures: Fixture[] = ['shared', 'wxml'].map(cohort => ({ id: cohort, source: '<view/>', bytes: 7, sha256: cohort, origins: [], platform: 'weapp', cohort: cohort as 'shared' | 'wxml', size: 'small' }))
    const calls: string[] = []
    const operations: Operation[] = [...CORE_OPERATIONS, 'consumer-scanner', 'consumer-web', 'consumer-simulator'].map(id => ({
      id,
      comparable: id !== 'preserve-noop',
      run(fixture, arm) {
        calls.push(`${id}:${fixture.id}:${arm}`)
        if (id === 'consumer-scanner' && arm === 'baseline' && fixture.cohort === 'shared') {
          throw new Error('real parser failure')
        }
      },
      verify: fixture => ({ equal: fixture.cohort === 'wxml', baseline: 'a', candidate: fixture.cohort === 'wxml' ? 'a' : 'b' }),
    }))
    const result = checkCorrectness(operations, fixtures, operations.map(operation => operation.id))
    expect(result.status).toBe('failed')
    expect(result.samples).toEqual([])
    expect(result.parity).toHaveLength(16)
    expect(result.semanticFailures).toHaveLength(8)
    expect(result.errors).toEqual([expect.objectContaining({ operation: 'consumer-scanner', arm: 'baseline', fixture: 'shared' })])
    expect(calls).toHaveLength(32)
    expect(calls.at(-1)).toBe('consumer-simulator:wxml:candidate')
  })
})
