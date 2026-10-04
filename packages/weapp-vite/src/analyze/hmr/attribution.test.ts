import { expect, it } from 'vitest'
import { attributeHmrProfile } from './attribution'

it('separates outer waits from nested hook work and preserves unknown measurements', () => {
  const result = attributeHmrProfile({ totalMs: 100, watchToDirtyMs: 30, batchWaitMs: 20, queueWaitMs: 5, bundlerMs: 70, transformMs: 60, vueCompileMs: 40 })
  expect(result).toMatchObject({ status: 'complete', phases: { batchWaitMs: 20, queueWaitMs: 5, otherBeforeBuildMs: 5, bundlerMs: 70 }, profileResidualMs: 0 })
  expect(attributeHmrProfile({ totalMs: 100 }).phases).toEqual({ batchWaitMs: null, queueWaitMs: null, otherBeforeBuildMs: null, bundlerMs: null })
  expect(attributeHmrProfile({ totalMs: 10, watchToDirtyMs: 20, bundlerMs: 5 }).profileResidualMs).toBeNull()
})

it('correlates a single source event across process clocks without reusing stale or ambiguous events', () => {
  const event = { eventId: 'edit-1', file: 'src/page.vue', receivedAtMs: 30 }
  const sample = { schemaVersion: 1, correlation: 'known' as const, totalMs: 50, clock: { durations: 'performance.now' as const, timestamp: 'UTC' as const, timeOrigin: 1000 }, sourceEvents: [event] }
  const observed = { sourceFile: 'src/page.vue', writtenAtEpochMs: 1020, visibleAtEpochMs: 1100 }
  expect(attributeHmrProfile(sample, observed).external).toEqual({ status: 'matched', eventId: 'edit-1', sourceToWatcherMs: 10, afterProfileToVisibleMs: 20 })
  expect(attributeHmrProfile(sample, { ...observed, writtenAtEpochMs: 1040 }).external.status).toBe('unknown')
  expect(attributeHmrProfile({ ...sample, sourceEvents: [event, { ...event, eventId: 'edit-2' }] }, observed).external.status).toBe('unknown')
  expect(attributeHmrProfile({ ...sample, totalMs: 200 }, observed).external.afterProfileToVisibleMs).toBeNull()
})
