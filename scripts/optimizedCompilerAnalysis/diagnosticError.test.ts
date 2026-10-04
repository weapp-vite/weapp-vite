import { expect, it } from 'vitest'
import { serializeDiagnosticError } from './diagnosticError'

it('preserves every cleanup failure and repeats the primary cause without losing its details', () => {
  const primary = new SyntaxError('compiler failed')
  const secondary = new Error('script owner leaked')
  const third = new Error('binding owner leaked')
  const result = serializeDiagnosticError(new AggregateError([primary, new AggregateError([secondary, third], 'cleanup')], 'execution', { cause: primary }))
  expect(result).toEqual({
    name: 'AggregateError',
    message: 'execution',
    cause: { name: 'SyntaxError', message: 'compiler failed' },
    errors: [
      { name: 'SyntaxError', message: 'compiler failed' },
      { name: 'AggregateError', message: 'cleanup', errors: [
        { name: 'Error', message: 'script owner leaked' },
        { name: 'Error', message: 'binding owner leaked' },
      ] },
    ],
  })
})

it('terminates cyclic causes and aggregate members while retaining scalar thrown values', () => {
  const cause = new Error('self')
  cause.cause = cause
  const aggregate = new AggregateError([cause, 'primitive failure', undefined], 'aggregate')
  aggregate.errors.push(aggregate)
  expect(serializeDiagnosticError(aggregate)).toEqual({
    name: 'AggregateError',
    message: 'aggregate',
    errors: [
      { name: 'Error', message: 'self', cause: { name: 'CircularError', message: 'Circular error reference' } },
      { name: 'Error', message: 'primitive failure' },
      { name: 'Error', message: 'undefined' },
      { name: 'CircularError', message: 'Circular error reference' },
    ],
  })
})
