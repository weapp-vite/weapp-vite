import { expect, it } from 'vitest'
import { restoreSequenceError, serializeSequenceError } from './errorEvidence'

it('round trips worker causes and aggregate errors without losing their stacks', () => {
  const timeout = new DOMException('The operation timed out', 'TimeoutError')
  const observation = new Error('waiting for classic output publication', { cause: timeout })
  const error = new AggregateError([observation, new Error('cleanup failed')], 'run and cleanup failed', { cause: new Error('sequence failed') })
  const evidence = serializeSequenceError(error)
  const restored = restoreSequenceError(evidence)

  expect(restored).toBeInstanceOf(AggregateError)
  expect(serializeSequenceError(restored)).toEqual(evidence)
  expect(evidence).toMatchObject({
    cause: { message: 'sequence failed' },
    errors: [
      { message: 'waiting for classic output publication', cause: { name: 'TimeoutError', message: 'The operation timed out', stack: timeout.stack } },
      { message: 'cleanup failed' },
    ],
  })
})

it('serializes circular causes while preserving repeated independent aggregate branches', () => {
  const error = new Error('recursive cause')
  error.cause = error
  const evidence = serializeSequenceError(new AggregateError([error, error], 'both references'))

  expect(evidence.errors).toEqual([
    { name: 'Error', message: 'recursive cause', stack: error.stack, cause: { name: 'Error', message: '[Circular error reference]' } },
    { name: 'Error', message: 'recursive cause', stack: error.stack, cause: { name: 'Error', message: '[Circular error reference]' } },
  ])
  expect(() => JSON.stringify(evidence)).not.toThrow()
})

it('preserves non-Error thrown values as diagnostic messages', () => {
  const restored = restoreSequenceError(serializeSequenceError(new Error('outer', { cause: 'worker disconnected' })))
  expect(restored.cause).toMatchObject({ message: 'worker disconnected' })
})
