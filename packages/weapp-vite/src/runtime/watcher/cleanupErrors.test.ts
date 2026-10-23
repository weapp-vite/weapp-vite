import { expect, it } from 'vitest'
import { deduplicateCleanupErrors } from './cleanupErrors'

it('retains untouched aggregate structure and independent errors with identical messages', () => {
  const first = new Error('same message')
  const second = new Error('same message')
  const aggregate = new AggregateError([first, second], 'session close failed')

  const failures = deduplicateCleanupErrors([aggregate])

  expect(failures).toHaveLength(1)
  expect(failures[0]).toBe(aggregate)
  expect(aggregate.errors[0]).toBe(first)
  expect(aggregate.errors[1]).toBe(second)
})

it('does not repeat a leaf already reported through an aggregate', () => {
  const shared = new Error('shared resource failed')
  const independent = new Error('independent resource failed')
  const aggregate = new AggregateError([shared, independent], 'session close failed')

  const failures = deduplicateCleanupErrors([aggregate, shared])

  expect(failures).toHaveLength(1)
  expect(failures[0]).toBe(aggregate)
})

it('reduces overlapping aggregate branches while preserving original leaf causes and diagnostics', () => {
  const shared = new Error('resource failed')
  const independent = new Error('resource failed')
  const cause = new Error('original aggregate cause')
  const aggregate = new AggregateError([shared, independent], 'session close failed', { cause })

  const failures = deduplicateCleanupErrors([shared, aggregate])

  expect(failures).toHaveLength(2)
  expect(failures[0]).toBe(shared)
  expect(failures[1]).toBeInstanceOf(AggregateError)
  const remaining = failures[1] as AggregateError
  expect(remaining.errors).toHaveLength(1)
  expect(remaining.errors[0]).toBe(independent)
  expect(remaining.message).toBe(aggregate.message)
  expect(remaining.stack).toBe(aggregate.stack)
  expect(remaining.cause).toBe(cause)
})

it('retains empty aggregates and raw rejection reasons including undefined', () => {
  const empty = new AggregateError([], 'resource cleanup failed without details')
  const failures = deduplicateCleanupErrors([empty, empty, undefined, undefined, null, 'raw failure'])

  expect(failures).toEqual([empty, undefined, null, 'raw failure'])
  expect(failures[0]).toBe(empty)
})
