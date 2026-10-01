import { expect, it } from 'vitest'
import { classifyOperationError, isRecoverableOperationError } from './errors'

it.each([
  ['ENOENT', 'invalid-path', false],
  ['EACCES', 'invalid-path', false],
  ['DEVTOOLS_LOGIN_REQUIRED', 'login-required', false],
  ['Unexpected server response: 403', 'protocol-rejected', false],
  ['ECONNREFUSED', 'service-unavailable', true],
  ['ECONNRESET', 'connection-transient', true],
  ['DEVTOOLS_PROTOCOL_TIMEOUT', 'timeout', true],
  ['unexpected failure', 'unknown', false],
] as const)('classifies the preserved cause %s through a connection wrapper', (message, category, retryable) => {
  const error = new Error('Failed connecting to websocket', { cause: new Error(message) })
  expect(classifyOperationError(error)).toBe(category)
  expect(isRecoverableOperationError(error)).toBe(retryable)
})

it('does not retry unknown errors or loop over a cyclic cause chain', () => {
  const error = new Error('unknown')
  error.cause = error
  expect(classifyOperationError(error)).toBe('unknown')
  expect(isRecoverableOperationError(error)).toBe(false)
})

it('recognizes structured login and cancellation errors without parsing arbitrary output', () => {
  expect(classifyOperationError(Object.assign(new Error('authentication'), { code: 10 }))).toBe('login-required')
  expect(classifyOperationError(new DOMException('This operation was aborted', 'AbortError'))).toBe('canceled')
})
