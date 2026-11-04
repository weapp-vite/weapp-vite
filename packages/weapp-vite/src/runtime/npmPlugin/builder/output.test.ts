import { expect, it } from 'vitest'
import { settlePackageBuilds } from './output'

it.each([new Error('first npm failure'), undefined, null])('preserves the first observed rejection while waiting for later failures: %s', async (firstFailure) => {
  const source = Promise.withResolvers<void>()
  const main = Promise.withResolvers<void>()
  let settled = false
  const result = settlePackageBuilds([source.promise, main.promise]).finally(() => {
    settled = true
  })
  const rejected = expect(result).rejects.toBe(firstFailure)
  try {
    main.reject(firstFailure)
    await new Promise<void>(resolve => setImmediate(resolve))
    expect(settled).toBe(false)
  }
  finally {
    source.reject(new Error('later source npm failure'))
    await rejected
  }
})
