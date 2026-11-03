import type { Operation, Sample } from './types'
import { describe, expect, it } from 'vitest'
import { CORE_OPERATIONS } from './contracts'
import { summarize } from './statistics'

const comparable = [...CORE_OPERATIONS.filter(id => id !== 'preserve-noop'), 'consumer-scanner', 'consumer-web', 'consumer-simulator']

function samples(operation: string, cohort: string, current: number, phase: Sample['phase'] = 'primary'): Sample[] {
  return Array.from({ length: 40 }, (_, round) => (round % 2 ? ['candidate', 'baseline'] as const : ['baseline', 'candidate'] as const).map(arm => ({ operation, cohort, round, arm, phase, durationMs: arm === 'baseline' ? 100 : current, iterations: 10, documents: 464, bytes: 400000 }))).flat()
}

describe('v4 full real corpus and WXML category gates', () => {
  it.each(comparable)('enforces the unchanged zero-regression aggregate gate for %s', (id) => {
    const operation: Operation = { id, comparable: true, run: () => undefined }
    for (const cohort of ['shared', 'real-all']) {
      expect(summarize(samples(id, cohort, 100), operation, cohort, 40).status).toBe('passed')
      expect(summarize(samples(id, cohort, 101), operation, cohort, 40).status).toBe('incomplete')
      expect(summarize([...samples(id, cohort, 101), ...samples(id, cohort, 102, 'confirmation')], operation, cohort, 40).status).toBe('regression')
      expect(summarize([...samples(id, cohort, 101), ...samples(id, cohort, 99, 'confirmation')], operation, cohort, 40).status).toBe('unstable')
    }
  })

  it.each(comparable)('enforces the same five-percent limit for WXML categories and %s', (id) => {
    const operation: Operation = { id, comparable: true, run: () => undefined }
    for (const cohort of ['wxml', 'wxml-script', 'shared-small', 'stress-long-text-1024']) {
      expect(summarize(samples(id, cohort, 105), operation, cohort, 40).status).toBe('passed')
      expect(summarize(samples(id, cohort, 106), operation, cohort, 40).status).toBe('incomplete')
      expect(summarize([...samples(id, cohort, 106), ...samples(id, cohort, 107, 'confirmation')], operation, cohort, 40).status).toBe('regression')
      expect(summarize([...samples(id, cohort, 106), ...samples(id, cohort, 104, 'confirmation')], operation, cohort, 40).status).toBe('unstable')
    }
  })

  it('keeps preserve-noop informational across every aggregate and category', () => {
    const operation: Operation = { id: 'preserve-noop', comparable: false, run: () => undefined }
    for (const cohort of ['shared', 'real-all', 'wxml', 'wxml-script', 'stress-long-text-1024']) {
      expect(summarize(samples(operation.id, cohort, 10000), operation, cohort, 40).status).toBe('informational')
    }
  })
})
