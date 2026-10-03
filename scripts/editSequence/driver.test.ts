import type { SequenceStepResult } from './measurement'
import { expect, it, vi } from 'vitest'
import { hashSequenceObservation, verifyEditSequence } from './driver'

it('retains the failing stage without inventing zero timing for unobserved work', async () => {
  const samples: SequenceStepResult[] = []
  const close = vi.fn(async () => {})
  const fresh = vi.fn(async () => ({}))
  await expect(verifyEditSequence({ name: 'failure', files: {}, steps: [] }, {
    name: 'failed-worker',
    incremental: async () => { throw new Error('worker stopped') },
    fresh,
    close,
  }, { onStep: sample => samples.push(sample) })).rejects.toThrow('failed before comparison')
  expect(samples).toEqual([{ step: 0, label: 'initial', status: 'failed', elapsedMs: expect.any(Number) }])
  expect(fresh).not.toHaveBeenCalled()
  expect(close).toHaveBeenCalledOnce()
})

it('compares profile on/off evidence without erasing array order or runtime values', () => {
  expect(hashSequenceObservation({ files: { b: 2, a: 1 }, pages: ['a', 'b'] })).toBe(hashSequenceObservation({ pages: ['a', 'b'], files: { a: 1, b: 2 } }))
  expect(hashSequenceObservation({ pages: ['a', 'b'] })).not.toBe(hashSequenceObservation({ pages: ['b', 'a'] }))
  expect(hashSequenceObservation({ message: 'before' })).not.toBe(hashSequenceObservation({ message: 'after' }))
})

it('preserves a semantic divergence when cleanup also fails', async () => {
  const result = verifyEditSequence({ name: 'divergence', files: {}, steps: [] }, {
    name: 'worker',
    incremental: async () => ({ message: 'stale' }),
    fresh: async () => ({ message: 'current' }),
    close: async () => { throw new Error('cleanup failed') },
  })
  await expect(result).rejects.toMatchObject({
    errors: [expect.objectContaining({ name: 'EditSequenceDivergence' }), expect.objectContaining({ message: 'cleanup failed' })],
  })
})
