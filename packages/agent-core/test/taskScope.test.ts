import { expect, it } from 'vitest'
import { createTaskScope } from './taskScope'

it('waits for pending I/O before allowing cleanup after cancellation', async () => {
  const timeout = new AbortController()
  const tasks = createTaskScope(timeout.signal)
  const release = Promise.withResolvers<void>()
  const operation = tasks.run(() => release.promise)
  timeout.abort()
  let cleaned = false
  const closing = tasks.close().then(() => {
    cleaned = true
  })
  await Promise.resolve()
  expect(cleaned).toBe(false)
  expect(tasks.signal.aborted).toBe(true)
  expect(() => tasks.run(async () => {})).toThrow()
  release.resolve()
  await Promise.all([operation, closing])
  expect(cleaned).toBe(true)
})

it('drains a rejected operation without masking its failure', async () => {
  const tasks = createTaskScope(new AbortController().signal)
  const release = Promise.withResolvers<void>()
  const operation = tasks.run(() => release.promise)
  const failure = expect(operation).rejects.toThrow('cancelled I/O')
  const closing = tasks.close()
  release.reject(new Error('cancelled I/O'))
  await Promise.all([failure, closing, tasks.close()])
})
