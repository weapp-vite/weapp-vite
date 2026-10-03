import { expect, it, vi } from 'vitest'
import { observeSettledSequencePublication, SequencePublicationBarrier } from './publicationBarrier'

it('reads runtime and output evidence only after existing snapshot publication settles', async () => {
  const publication = Promise.withResolvers<void>()
  const read = vi.fn(() => ({ runtime: 'updated', output: 'published' }))
  const waiting = observeSettledSequencePublication(() => publication.promise, read, new AbortController().signal)
  await Promise.resolve()
  expect(read).not.toHaveBeenCalled()
  publication.resolve()
  expect(await waiting).toEqual({ runtime: 'updated', output: 'published' })
  expect(read).toHaveBeenCalledOnce()
})

it('propagates settlement failures without sampling a partial publication', async () => {
  const error = new Error('snapshot failed')
  const read = vi.fn()
  await expect(observeSettledSequencePublication(async () => {
    throw error
  }, read, new AbortController().signal)).rejects.toBe(error)
  expect(read).not.toHaveBeenCalled()
})

it('does not sample after the observation boundary aborts while settlement is pending', async () => {
  const publication = Promise.withResolvers<void>()
  const controller = new AbortController()
  const error = new Error('sequence timed out')
  const read = vi.fn()
  const rejected = expect(observeSettledSequencePublication(() => publication.promise, read, controller.signal)).rejects.toBe(error)
  controller.abort(error)
  await rejected
  publication.resolve()
  await Promise.resolve()
  await Promise.resolve()
  expect(read).not.toHaveBeenCalled()
})

it('holds the next save until consumed code is delivered and the native transaction commits', async () => {
  const barrier = new SequencePublicationBarrier<{ value: string }>()
  const delivered = Promise.withResolvers<void>()
  const coordinator = Promise.withResolvers<void>()
  const consumed = Promise.withResolvers<void>()
  const settling = Promise.withResolvers<void>()
  const events: string[] = []
  const settle = vi.fn(async () => {
    events.push('coordinator entered')
    settling.resolve()
    await coordinator.promise
    events.push('coordinator committed')
  })
  barrier.consume(() => ({ value: 'initial' }), Promise.resolve())
  const nextSave = barrier.waitFor(value => value.value === 'intermediate', settle, new AbortController().signal).then((value) => {
    events.push('second save')
    return value
  })
  barrier.consume(() => {
    events.push('intermediate executed')
    consumed.resolve()
    return { value: 'intermediate' }
  }, delivered.promise)
  await consumed.promise
  expect(events).toEqual(['intermediate executed'])
  expect(settle).not.toHaveBeenCalled()

  events.push('delivery acknowledged')
  delivered.resolve()
  await settling.promise
  expect(events).toEqual(['intermediate executed', 'delivery acknowledged', 'coordinator entered'])

  coordinator.resolve()
  expect(await nextSave).toEqual({ value: 'intermediate' })
  expect(events).toEqual(['intermediate executed', 'delivery acknowledged', 'coordinator entered', 'coordinator committed', 'second save'])
})

it('retains a consumed publication before subscription without eagerly executing observation reads', async () => {
  const barrier = new SequencePublicationBarrier<string>()
  const read = vi.fn(() => 'intermediate')
  const settle = vi.fn(async () => {})
  barrier.consume(read, Promise.resolve())
  expect(read).not.toHaveBeenCalled()
  expect(await barrier.waitFor(value => value === 'intermediate', settle, new AbortController().signal)).toBe('intermediate')
  expect(read).toHaveBeenCalledOnce()
  expect(settle).toHaveBeenCalledOnce()
})

it('preserves delivery failure and never releases the next save', async () => {
  const barrier = new SequencePublicationBarrier<string>()
  const delivered = Promise.withResolvers<void>()
  const settle = vi.fn(async () => {})
  const saved = vi.fn()
  barrier.consume(() => 'intermediate', delivered.promise)
  const nextSave = barrier.waitFor(() => true, settle, new AbortController().signal).then(saved)
  const rejection = expect(nextSave).rejects.toThrow('delivery failed')
  delivered.reject(new Error('delivery failed'))
  await rejection
  expect(settle).not.toHaveBeenCalled()
  expect(saved).not.toHaveBeenCalled()
})
