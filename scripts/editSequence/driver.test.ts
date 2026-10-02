import type { SequenceStepResult } from './measurement'
import { expect, it, vi } from 'vitest'
import { verifyEditSequence } from './driver'

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
