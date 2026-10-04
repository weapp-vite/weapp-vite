import { expect, it, vi } from 'vitest'
import { assertSuccessfulSequenceBuild } from './buildObservation'
import { verifyEditSequence } from './driver'

it('requires a successful published observation for valid build input', () => {
  expect(() => assertSuccessfulSequenceBuild({ diagnostics: [], published: { semantics: { value: 'one' } } })).not.toThrow()
  expect(() => assertSuccessfulSequenceBuild({ diagnostics: [] })).toThrow('Missing published runtime observation')
  expect(() => assertSuccessfulSequenceBuild({ published: {} })).toThrow('Expected a successful sequence build')
})

it('rejects identical build failures before treating resource samples as equivalent', async () => {
  const failure = { diagnostics: [{ code: 'BUILD_FAILED', message: 'entry was not compiled' }] }
  const fresh = vi.fn(async () => failure)
  const close = vi.fn(async () => {})
  const steps: unknown[] = []
  const result = verifyEditSequence({ name: 'resource-initial-build', files: {}, steps: [] }, {
    name: 'build',
    incremental: async () => {
      assertSuccessfulSequenceBuild(failure)
      return failure
    },
    fresh,
    close,
  }, { onStep: step => steps.push(step) })
  await expect(result).rejects.toMatchObject({ cause: { message: expect.stringContaining('Expected a successful sequence build') } })
  expect(fresh).not.toHaveBeenCalled()
  expect(close).toHaveBeenCalledOnce()
  expect(steps).toEqual([expect.objectContaining({ step: 0, status: 'failed' })])
})
