import assert from 'node:assert/strict'
import { UnconfirmedContractCleanupError } from '../helpers.mjs'

/** 始终等待当前 bundle 关闭，并同时保留场景首错与资源收尾错误。 */
export async function withBundle(rolldown, options, inspect) {
  const bundle = await rolldown(options)
  let result
  let failure
  try {
    result = await inspect(bundle)
  }
  catch (error) {
    failure = { error }
  }
  const [cleanup] = await Promise.allSettled([Promise.resolve().then(() => bundle.close())])
  const cleanupErrors = []
  if (cleanup.status === 'rejected') {
    cleanupErrors.push(cleanup.reason)
  }
  else {
    try {
      assert.equal(bundle.closed, true, 'Public bundle close must confirm the acquired handle is closed')
    }
    catch (error) {
      cleanupErrors.push(error)
    }
  }
  if (cleanupErrors.length) {
    throw new UnconfirmedContractCleanupError(failure ? [failure.error, ...cleanupErrors] : cleanupErrors, 'Public build contract cleanup failed', { cause: failure ? failure.error : cleanupErrors[0] })
  }
  if (failure) {
    throw failure.error
  }
  return result
}
