import { afterEach, beforeEach, expect, it, vi } from 'vitest'
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

it.each(['incremental', 'fresh'] as const)('does not fork or send for pre-aborted %s', async (method) => {
  const reason = new Error('already cancelled')
  const observer = createProcessObserver('compiler', 'fixture')
  await expect(observer[method](input(AbortSignal.abort(reason)))).rejects.toBe(reason)
  expect(fork).not.toHaveBeenCalled()
  await observer.close()
})

it('propagates the matching request id and complete error while keeping the parent reason', async () => {
  const child = new FakeChild()
  fork.mockReturnValue(child)
  const observer = createProcessObserver('compiler', 'fixture')
  const controller = new AbortController()
  const reason = new AggregateError([new Error('original observation')], 'outer deadline', { cause: new Error('underlying deadline') })
  reason.name = 'TimeoutError'
  const operation = observer.incremental(input(controller.signal))
  const rejected = expect(operation).rejects.toBe(reason)
  controller.abort(reason)
  await rejected
  expect(child.send.mock.calls[1]?.[0]).toMatchObject({ type: 'cancel', id: 1, reason: {
    name: 'TimeoutError',
    message: 'outer deadline',
    cause: { message: 'underlying deadline' },
    errors: [{ message: 'original observation' }],
  } })
  child.emit('message', { id: 1, value: 'late reply' })
  expect(child.listenerCount('message')).toBe(0)
  expect(child.listenerCount('error')).toBe(0)
  const closing = observer.close()
  child.exit()
  await closing
})

it('catches cancellation during listener registration without sending a request', async () => {
  const child = new FakeChild()
  fork.mockReturnValue(child)
  const controller = new AbortController()
  const reason = new Error('registration race')
  const add = controller.signal.addEventListener.bind(controller.signal)
  vi.spyOn(controller.signal, 'addEventListener').mockImplementation((...args) => {
    add(...args)
    controller.abort(reason)
  })
  const observer = createProcessObserver('compiler', 'fixture')
  await expect(observer.incremental(input(controller.signal))).rejects.toBe(reason)
  expect(child.send).not.toHaveBeenCalled()
  const closing = observer.close()
  child.exit()
  await closing
})

it('shares fresh-finally and concurrent close completion, listeners and watchdog', async () => {
  const child = new FakeChild()
  fork.mockReturnValue(child)
  const observer = createProcessObserver('compiler', 'fixture')
  const controller = new AbortController()
  const reason = new Error('outer deadline')
  const operation = observer.fresh(input(controller.signal))
  const rejected = expect(operation).rejects.toBe(reason)
  controller.abort(reason)
  await flush()
  const closing = observer.close()
  expect(observer.close()).toBe(closing)
  expect(child.send.mock.calls.filter(([message]) => (message as { type?: string }).type === 'close')).toHaveLength(1)
  expect(vi.getTimerCount()).toBe(1)
  expect(child.listenerCount('exit')).toBe(1)
  child.exit()
  await Promise.all([rejected, closing])
  expect(vi.getTimerCount()).toBe(0)
  expect(child.listenerCount('exit')).toBe(0)
  expect(observer.resources?.()).toEqual({ children: 0 })
})

it('keeps the 10 second watchdog and both observation and cleanup failures', async () => {
  const child = new FakeChild()
  fork.mockReturnValue(child)
  const observer = createProcessObserver('compiler', 'fixture')
  const controller = new AbortController()
  const reason = new Error('outer deadline')
  const operation = observer.fresh(input(controller.signal))
  const rejected = expect(operation).rejects.toMatchObject({ errors: [reason, expect.objectContaining({ message: expect.stringContaining('SIGKILL') })] })
  controller.abort(reason)
  await flush()
  const closing = observer.close()
  const closeFailure = expect(closing).rejects.toThrow('SIGKILL')
  await vi.advanceTimersByTimeAsync(9_999)
  expect(child.kill).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  await Promise.all([rejected, closeFailure])
  expect(child.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL')
})

it('detects abnormal exit before stop starts and preserves the request error', async () => {
  const child = new FakeChild()
  fork.mockReturnValue(child)
  const observer = createProcessObserver('compiler', 'fixture')
  const operation = observer.fresh(input())
  const rejected = expect(operation).rejects.toMatchObject({ errors: [
    expect.objectContaining({ message: 'Edit observer compiler exited (2)' }),
    expect.objectContaining({ message: expect.stringContaining('exit=2') }),
  ] })
  child.exit(2)
  await rejected
  expect(vi.getTimerCount()).toBe(0)
  await expect(observer.close()).rejects.toThrow('exit=2')
})

it('does not cancel or close another owned session when cancelling a fresh request', async () => {
  const incremental = new FakeChild()
  const fresh = new FakeChild()
  fork.mockReturnValueOnce(incremental).mockReturnValueOnce(fresh)
  const observer = createProcessObserver('compiler', 'fixture')
  const first = observer.incremental(input())
  incremental.emit('message', { id: 1, value: 'first' })
  await first
  const controller = new AbortController()
  const reason = new Error('fresh only')
  const operation = observer.fresh(input(controller.signal))
  const rejected = expect(operation).rejects.toBe(reason)
  controller.abort(reason)
  await flush()
  expect(fresh.send.mock.calls[1]?.[0]).toMatchObject({ type: 'cancel', id: 2 })
  expect(incremental.send).toHaveBeenCalledOnce()
  expect(incremental.kill).not.toHaveBeenCalled()
  fresh.exit()
  await rejected
  const next = observer.incremental(input())
  incremental.emit('message', { id: 3, value: 'next' })
  expect(await next).toBe('next')
  const closing = observer.close()
  incremental.exit()
  await closing
})

it('does not publish a late measurement after cancellation wins during process sampling', async () => {
  const child = new FakeChild()
  fork.mockReturnValue(child)
  const sampled = Promise.withResolvers<unknown>()
  processTree.mockReturnValue(sampled.promise)
  const observer = createProcessObserver('compiler', 'fixture', { resources: true })
  const controller = new AbortController()
  const reason = new Error('sampling cancelled')
  const operation = observer.incremental(input(controller.signal))
  const rejected = expect(operation).rejects.toBe(reason)
  child.emit('message', { id: 1, value: 'result', measurement: { elapsedMs: 1 } })
  controller.abort(reason)
  await rejected
  sampled.resolve({ rssBytes: 1 })
  await flush()
  expect(observer.measure?.()).toBeUndefined()
  const closing = observer.close()
  child.exit()
  await closing
})

it('preserves cancellation delivery failure alongside the original abort reason', async () => {
  const child = new FakeChild()
  const transport = new Error('IPC closed')
  child.send.mockImplementation((message, callback) => {
    callback?.((message as { type?: string }).type === 'cancel' ? transport : null)
    return true
  })
  fork.mockReturnValue(child)
  const observer = createProcessObserver('compiler', 'fixture')
  const controller = new AbortController()
  const reason = new Error('outer deadline')
  const operation = observer.fresh(input(controller.signal))
  const rejected = expect(operation).rejects.toMatchObject({ errors: [reason, expect.objectContaining({ message: 'Worker request cancellation could not be delivered', cause: transport })] })
  controller.abort(reason)
  await flush()
  child.exit()
  await rejected
})

it('does not send cancellation after a successful reply or start requests after close', async () => {
  const child = new FakeChild()
  fork.mockReturnValue(child)
  const observer = createProcessObserver('compiler', 'fixture')
  const controller = new AbortController()
  const operation = observer.incremental(input(controller.signal))
  child.emit('message', { id: 1, value: 'success' })
  expect(await operation).toBe('success')
  controller.abort(new Error('too late'))
  expect(child.send).toHaveBeenCalledOnce()
  const closing = observer.close()
  await expect(observer.fresh(input())).rejects.toThrow('closing')
  expect(fork).toHaveBeenCalledOnce()
  child.exit()
  await closing
})
