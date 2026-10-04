import type { SequenceStepResult } from './measurement'
import { expect, it, vi } from 'vitest'
import { hashSequenceObservation, verifyEditSequence } from './driver'

it('compares each complete output before observing its runtime and before the next edit', async () => {
  const events: string[] = []
  await verifyEditSequence({ name: 'production', files: {}, steps: [
    { name: 'new generation', action: { kind: 'write', file: 'page.js', content: 'next' } },
  ] }, {
    name: 'runtime',
    incremental: async ({ step }) => {
      events.push(`incremental-${step}`)
      return { step }
    },
    fresh: async ({ step }) => {
      events.push(`fresh-${step}`)
      return { step }
    },
    afterCompare: async ({ step, files }) => {
      events.push(`runtime-${step}`)
      expect(files['page.js']).toBe(step === 0 ? undefined : 'next')
    },
    close: async () => { events.push('close') },
  }, { compare: (incremental, fresh) => {
    expect(incremental).toEqual(fresh)
    events.push(`compare-${incremental.step}`)
    return undefined
  } })
  expect(events).toEqual(['incremental-0', 'fresh-0', 'compare-0', 'runtime-0', 'incremental-1', 'fresh-1', 'compare-1', 'runtime-1', 'close'])
})

it('never starts runtime for divergent output', async () => {
  const afterCompare = vi.fn(async () => {})
  const close = vi.fn(async () => {})
  await expect(verifyEditSequence({ name: 'divergent', files: {}, steps: [] }, {
    name: 'runtime',
    incremental: async () => ({ file: 'stale' }),
    fresh: async () => ({ file: 'current' }),
    afterCompare,
    close,
  })).rejects.toMatchObject({ name: 'EditSequenceDivergence' })
  expect(afterCompare).not.toHaveBeenCalled()
  expect(close).toHaveBeenCalledOnce()
})

it('preserves compared output evidence and the runtime cause without continuing to the next edit', async () => {
  const failure = new Error('runtime read the previous generation')
  const outputs = { file: 'current' }
  const samples: SequenceStepResult[] = []
  const incremental = vi.fn(async () => outputs)
  const close = vi.fn(async () => {})
  await expect(verifyEditSequence({ name: 'runtime-failure', files: {}, steps: [
    { name: 'must not run', action: { kind: 'write', file: 'page.js', content: 'next' } },
  ] }, {
    name: 'runtime',
    incremental,
    fresh: async () => outputs,
    afterCompare: async () => { throw failure },
    close,
  }, { onStep: result => samples.push(result) })).rejects.toMatchObject({ message: expect.stringContaining('failed after comparison'), cause: failure })
  expect(samples).toEqual([expect.objectContaining({ status: 'failed', observationSha256: hashSequenceObservation(outputs), incrementalMs: expect.any(Number), freshMs: expect.any(Number) })])
  expect(incremental).toHaveBeenCalledOnce()
  expect(close).toHaveBeenCalledOnce()
})

it('applies the existing abort budget to post-comparison observation and preserves cleanup failures', async () => {
  const cleanupFailure = new Error('owned session did not close')
  await expect(verifyEditSequence({ name: 'runtime-timeout', files: {}, steps: [] }, {
    name: 'runtime',
    incremental: async () => ({}),
    fresh: async () => ({}),
    afterCompare: async () => new Promise(() => {}),
    close: async () => { throw cleanupFailure },
  }, { timeoutMs: 10 })).rejects.toMatchObject({ errors: [expect.objectContaining({ message: expect.stringContaining('failed after comparison'), cause: expect.objectContaining({ name: 'TimeoutError' }) }), cleanupFailure] })
})
