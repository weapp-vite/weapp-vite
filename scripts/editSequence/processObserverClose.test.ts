import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { bounded } from './driver'
import { createProcessObserver } from './processObserver'
import { FakeChild, flush } from './testUtils/fakeChild'

const { fork, processTree } = vi.hoisted(() => ({ fork: vi.fn(), processTree: vi.fn() }))
vi.mock('node:child_process', () => ({ fork }))
vi.mock('./processTree', () => ({ observeProcessTree: processTree }))

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})
const input = (signal = new AbortController().signal) => ({ files: {}, step: 0, signal })

it('retains a background fresh cleanup failure after bounded rejects and the child leaves the live set', async () => {
  const child = new FakeChild()
  fork.mockReturnValue(child)
  const observer = createProcessObserver('compiler', 'fixture')
  const controller = new AbortController()
  const reason = new Error('outer deadline')
  const result = bounded(() => observer.fresh(input(controller.signal)), controller.signal)
  const rejected = expect(result).rejects.toBe(reason)
  controller.abort(reason)
  await rejected
  await flush()
  child.exit(2)
  await flush()
  expect(observer.resources?.()).toEqual({ children: 0 })
  await expect(observer.close()).rejects.toThrow('exit=2')
})

it.each(['callback', 'throw'] as const)('retains a %s close delivery failure after fallback termination', async (mode) => {
  const child = new FakeChild()
  const failure = new Error('close transport failure')
  child.send.mockImplementation((message, callback) => {
    if ((message as { type?: string }).type === 'close') {
      if (mode === 'throw') {
        throw failure
      }
      callback?.(failure)
    }
    else {
      callback?.(null)
    }
    return true
  })
  fork.mockReturnValue(child)
  const observer = createProcessObserver('compiler', 'fixture')
  const operation = observer.incremental(input())
  child.emit('message', { id: 1, value: 'complete' })
  await operation
  await expect(observer.close()).rejects.toMatchObject({ errors: [
    expect.objectContaining({ message: 'Worker close request could not be delivered', cause: failure }),
    expect.objectContaining({ message: expect.stringContaining('SIGTERM') }),
  ] })
  expect(child.kill).toHaveBeenCalledExactlyOnceWith('SIGTERM')
  expect(vi.getTimerCount()).toBe(0)
})

it('waits for all owned children and retains every cleanup failure', async () => {
  const first = new FakeChild()
  const second = new FakeChild()
  fork.mockReturnValueOnce(first).mockReturnValueOnce(second)
  const observer = createProcessObserver('compiler', 'fixture')
  const firstOperation = observer.incremental(input())
  first.emit('message', { id: 1, value: 'first' })
  await firstOperation
  const controller = new AbortController()
  const reason = new Error('fresh cancelled')
  const secondOperation = observer.fresh(input(controller.signal))
  const secondFailure = expect(secondOperation).rejects.toMatchObject({ errors: [reason, expect.objectContaining({ message: expect.stringContaining('exit=3') })] })
  controller.abort(reason)
  await flush()
  const closing = observer.close()
  let settled = false
  const closeFailure = expect(closing).rejects.toMatchObject({ errors: expect.arrayContaining([
    expect.objectContaining({ message: expect.stringContaining('exit=2') }),
    expect.objectContaining({ message: expect.stringContaining('exit=3') }),
  ]) }).then(() => {
    settled = true
  })
  first.exit(2)
  await flush()
  expect(settled).toBe(false)
  second.exit(3)
  await Promise.all([secondFailure, closeFailure])
  expect(observer.resources?.()).toEqual({ children: 0 })
  expect(vi.getTimerCount()).toBe(0)
})

it('awaits a cancellation callback arriving after child exit and retains its failure', async () => {
  const child = new FakeChild()
  let cancelled: ((error: Error | null) => void) | undefined
  child.send.mockImplementation((message, callback) => {
    if ((message as { type?: string }).type === 'cancel') {
      cancelled = callback
    }
    else {
      callback?.(null)
    }
    return true
  })
  fork.mockReturnValue(child)
  const observer = createProcessObserver('compiler', 'fixture')
  const controller = new AbortController()
  const reason = new Error('outer deadline')
  const operation = observer.fresh(input(controller.signal))
  const rejected = expect(operation).rejects.toMatchObject({ errors: [reason, expect.objectContaining({ cause: expect.objectContaining({ message: 'late transport failure' }) })] })
  controller.abort(reason)
  await flush()
  const closing = observer.close()
  let settled = false
  const closeFailure = expect(closing).rejects.toThrow('could not be delivered').then(() => {
    settled = true
  })
  child.exit()
  await flush()
  expect(settled).toBe(false)
  expect(observer.resources?.()).toEqual({ children: 1 })
  cancelled?.(new Error('late transport failure'))
  await Promise.all([rejected, closeFailure])
  expect(vi.getTimerCount()).toBe(0)
})

it('bounds a missing cancellation callback with the same close deadline', async () => {
  const child = new FakeChild()
  child.send.mockImplementation((message, callback) => {
    if ((message as { type?: string }).type !== 'cancel') {
      callback?.(null)
    }
    return true
  })
  fork.mockReturnValue(child)
  const observer = createProcessObserver('compiler', 'fixture')
  const controller = new AbortController()
  const reason = new Error('outer deadline')
  const operation = observer.fresh(input(controller.signal))
  const rejected = expect(operation).rejects.toMatchObject({ errors: [reason, expect.objectContaining({ message: expect.stringContaining('unconfirmed at the close deadline') })] })
  controller.abort(reason)
  await flush()
  child.exit()
  await vi.advanceTimersByTimeAsync(10_000)
  await rejected
  expect(child.kill).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})

it('awaits a close callback arriving after exit instead of declaring cleanup successful', async () => {
  const child = new FakeChild()
  let delivered: ((error: Error | null) => void) | undefined
  child.send.mockImplementation((message, callback) => {
    if ((message as { type?: string }).type === 'close') {
      delivered = callback
    }
    else {
      callback?.(null)
    }
    return true
  })
  fork.mockReturnValue(child)
  const observer = createProcessObserver('compiler', 'fixture')
  const operation = observer.incremental(input())
  child.emit('message', { id: 1, value: 'complete' })
  await operation
  const closing = observer.close()
  const rejected = expect(closing).rejects.toMatchObject({ message: 'Worker close request could not be delivered', cause: expect.objectContaining({ message: 'late close transport failure' }) })
  child.exit()
  await flush()
  expect(observer.resources?.()).toEqual({ children: 1 })
  delivered?.(new Error('late close transport failure'))
  await rejected
  expect(child.kill).not.toHaveBeenCalled()
})

it.each(['SIGABRT', 'SIGTERM'])('does not describe %s termination as graceful close', async (signal) => {
  const child = new FakeChild()
  fork.mockReturnValue(child)
  const observer = createProcessObserver('compiler', 'fixture')
  const operation = observer.incremental(input())
  child.emit('message', { id: 1, value: 'complete' })
  await operation
  const closing = observer.close()
  const rejected = expect(closing).rejects.toThrow(signal)
  child.exit(null, signal)
  await rejected
})
