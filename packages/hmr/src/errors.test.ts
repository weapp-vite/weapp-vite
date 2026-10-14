import { expect, it } from 'vitest'
import { HmrPreparationCleanupError } from './errors'

it('retains the primary error identity and each failed cleanup in a dedicated internal aggregate', () => {
  const primary = new Error('preparation failed')
  const first = new Error('first cleanup failed')
  const last = new Error('last cleanup failed')
  const error = new HmrPreparationCleanupError(primary, [first, last])
  expect(error).toBeInstanceOf(AggregateError)
  expect(error.errors).toEqual([primary, first, last])
  expect(error.cause).toBe(primary)
  expect(error.name).toBe('HmrPreparationCleanupError')
})
