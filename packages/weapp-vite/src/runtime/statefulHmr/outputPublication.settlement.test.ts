import { expect, it } from 'vitest'
import { StatefulHmrOutputPublication } from './outputPublication'

it('includes a newly queued native output while the first publication is still pending', async () => {
  const first = Promise.withResolvers<void>()
  const second = Promise.withResolvers<void>()
  const publication = new StatefulHmrOutputPublication()
  const firstOutput = publication.publish('full', () => first.promise)
  let settled = false
  const waiting = publication.whenSettled().then(() => {
    settled = true
  })
  const secondOutput = publication.publish('additional', () => second.promise)
  first.resolve()
  await firstOutput
  expect(settled).toBe(false)
  second.resolve()
  await Promise.all([secondOutput, waiting])
  expect(settled).toBe(true)
})

it('retains failed output until a later full baseline succeeds instead of hiding it behind unrelated assets', async () => {
  const publication = new StatefulHmrOutputPublication()
  const error = new Error('output failed')
  await expect(publication.publish('additional', () => {
    throw error
  })).rejects.toBe(error)
  await expect(publication.whenSettled()).rejects.toBe(error)
  await publication.publish('additional', async () => {})
  await expect(publication.whenSettled()).rejects.toBe(error)
  const recovered = Promise.withResolvers<void>()
  const output = publication.publish('full', () => recovered.promise)
  const waiting = publication.whenSettled()
  recovered.resolve()
  await Promise.all([output, waiting])
  await expect(publication.whenSettled()).resolves.toBeUndefined()
})

it('retains a late failure because an earlier completed full output cannot prove its final bytes recovered', async () => {
  const publication = new StatefulHmrOutputPublication()
  const old = Promise.withResolvers<void>()
  const output = publication.publish('additional', () => old.promise)
  const rejected = expect(output).rejects.toThrow('old write failed')
  await publication.publish('full', async () => {})
  old.reject(new Error('old write failed'))
  await rejected
  await expect(publication.whenSettled()).rejects.toThrow('old write failed')
  await publication.publish('full', async () => {})
  await expect(publication.whenSettled()).resolves.toBeUndefined()
})
