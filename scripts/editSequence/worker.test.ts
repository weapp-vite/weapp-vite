import type { Mock } from 'vitest'
import type { SequenceInput } from './driver'
import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { serializeSequenceError } from './errorEvidence'
import { flush } from './testUtils/fakeChild'

interface FakeWorkerProcess extends EventEmitter {
  argv: string[]
  env: Record<string, string>
  send: Mock
  exit: Mock
}

interface FakeWorkerSession {
  observe: Mock<(input: SequenceInput) => Promise<unknown>>
  close: Mock<() => Promise<void>>
  measurements: { snapshot: () => Record<string, unknown> }
  observeSession: () => Record<string, unknown>
}

const state = vi.hoisted(() => ({
  process: undefined as unknown as FakeWorkerProcess,
  session: undefined as unknown as FakeWorkerSession,
  gcClose: vi.fn(),
  gcSample: vi.fn<() => Promise<unknown>>(async () => ({})),
  resourceSample: vi.fn<() => Promise<unknown>>(async () => ({})),
}))
vi.mock('node:process', () => ({ default: state.process }))
vi.mock('node:fs/promises', () => ({ rm: vi.fn(async () => {}) }))
vi.mock('./build', () => ({ BuildSequenceSession: vi.fn() }))
vi.mock('./compiler', () => ({ observeCompiler: vi.fn() }))
vi.mock('./framework', () => ({
  FrameworkSequenceSession: class {
    constructor() {
      return state.session
    }
  },
}))
vi.mock('./measurement', () => ({
  sampleProcessResources: state.resourceSample,
  SequenceGcObserver: class {
    sample = state.gcSample
    close = state.gcClose
  },
}))

beforeEach(async () => {
  vi.resetModules()
  state.process = Object.assign(state.process ?? new EventEmitter(), {
    argv: ['node', 'worker.ts', 'weapp-classic', 'fixture', 'incremental'],
    env: {},
    send: vi.fn(),
    exit: vi.fn(),
  })
  state.session = { observe: vi.fn(), close: vi.fn(async () => {}), measurements: { snapshot: () => ({}) }, observeSession: () => ({}) }
  await import('./worker')
})
afterEach(() => {
  state.process.removeAllListeners()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})
const request = (id: number) => ({ id, files: {}, step: id - 1 })
const cancel = (id: number, reason: unknown) => ({ type: 'cancel', id, reason: serializeSequenceError(reason) })

it('delivers cancellation during close to the active observation without cancelling normal cleanup', async () => {
  let signal: AbortSignal | undefined
  state.session.observe.mockImplementation((input: { signal: AbortSignal }) => {
    signal = input.signal
    return new Promise((_resolve, reject) => input.signal.addEventListener('abort', () => reject(input.signal.reason), { once: true }))
  })
  state.process.emit('message', request(1))
  await flush()
  state.process.emit('message', { type: 'close' })
  await flush()
  expect(signal?.aborted).toBe(false)
  expect(state.session.close).not.toHaveBeenCalled()
  const reason = new AggregateError([new Error('inner')], 'outer deadline', { cause: new Error('origin') })
  reason.name = 'TimeoutError'
  state.process.emit('message', cancel(1, reason))
  await flush()
  expect(signal?.reason).toMatchObject({ name: 'TimeoutError', message: 'outer deadline', cause: { message: 'origin' }, errors: [{ message: 'inner' }] })
  expect(state.process.send).toHaveBeenCalledWith(expect.objectContaining({ id: 1, error: expect.objectContaining({ name: 'TimeoutError', message: 'outer deadline' }) }))
  expect(state.session.close).toHaveBeenCalledOnce()
  expect(state.gcClose).toHaveBeenCalledOnce()
  expect(state.process.exit).toHaveBeenCalledExactlyOnceWith(0)
})

it('cancels a queued request before observe and ignores unknown or completed ids', async () => {
  const first = Promise.withResolvers<string>()
  state.session.observe.mockReturnValueOnce(first.promise).mockResolvedValue('later')
  state.process.emit('message', request(1))
  state.process.emit('message', request(2))
  state.process.emit('message', cancel(2, new Error('queued cancelled')))
  state.process.emit('message', cancel(99, new Error('unknown')))
  await flush()
  const firstSignal = state.session.observe.mock.calls[0][0].signal
  expect(firstSignal.aborted).toBe(false)
  first.resolve('first')
  await flush()
  expect(state.session.observe).toHaveBeenCalledOnce()
  expect(state.process.send).toHaveBeenCalledWith({ id: 2, error: expect.objectContaining({ message: 'queued cancelled' }) })
  state.process.emit('message', cancel(1, new Error('already completed')))
  state.process.emit('message', request(3))
  await flush()
  expect(state.session.observe).toHaveBeenCalledTimes(2)
  expect(state.session.observe.mock.calls[1][0].signal.aborted).toBe(false)
  state.process.emit('message', { type: 'close' })
  await flush()
})

it('normal close waits for the active observation and remains idempotent', async () => {
  const observing = Promise.withResolvers<string>()
  state.session.observe.mockReturnValue(observing.promise)
  state.process.emit('message', request(1))
  await flush()
  const signal = state.session.observe.mock.calls[0][0].signal
  state.process.emit('message', { type: 'close' })
  state.process.emit('message', { type: 'close' })
  await flush()
  expect(signal.aborted).toBe(false)
  expect(state.session.close).not.toHaveBeenCalled()
  observing.resolve('complete')
  await flush()
  expect(state.session.close).toHaveBeenCalledOnce()
  expect(state.process.exit).toHaveBeenCalledExactlyOnceWith(0)
})

it('retains the independent 180 second worker deadline and its error', async () => {
  const deadline = new AbortController()
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal)
  state.session.observe.mockImplementation((input: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
    input.signal.addEventListener('abort', () => reject(input.signal.reason), { once: true })
  }))
  state.process.emit('message', request(1))
  await flush()
  expect(timeout).toHaveBeenCalledExactlyOnceWith(180_000)
  const reason = new DOMException('worker deadline', 'TimeoutError')
  deadline.abort(reason)
  await flush()
  expect(state.process.send).toHaveBeenCalledWith({ id: 1, error: expect.objectContaining({ name: 'TimeoutError', message: 'worker deadline' }) })
  state.process.emit('message', { type: 'close' })
  await flush()
})

it('retains an existing observation failure and reports cleanup failure separately', async () => {
  const observation = new Error('original observation')
  const cleanup = new Error('cleanup failed')
  state.session.observe.mockRejectedValue(observation)
  state.session.close.mockRejectedValue(cleanup)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  state.process.emit('message', request(1))
  await flush()
  expect(state.process.send).toHaveBeenCalledWith({ id: 1, error: expect.objectContaining({ message: observation.message }) })
  state.process.emit('message', { type: 'close' })
  await flush()
  expect(console.error).toHaveBeenCalledWith(cleanup)
  expect(state.process.exit).toHaveBeenCalledExactlyOnceWith(1)
})

it('does not sample or publish success when cancelled work resolves without checking its signal', async () => {
  const observing = Promise.withResolvers<string>()
  state.session.observe.mockReturnValue(observing.promise)
  state.process.emit('message', request(1))
  await flush()
  state.process.emit('message', cancel(1, new Error('cancelled before publication')))
  observing.resolve('late success')
  await flush()
  expect(state.gcSample).not.toHaveBeenCalled()
  expect(state.process.send).toHaveBeenCalledWith({ id: 1, error: expect.objectContaining({ message: 'cancelled before publication' }) })
  state.process.emit('message', { type: 'close' })
  await flush()
})

it('does not publish success when cancellation arrives during GC measurement', async () => {
  const sampling = Promise.withResolvers<unknown>()
  state.gcSample.mockReturnValueOnce(sampling.promise)
  state.session.observe.mockResolvedValue('observed')
  state.process.emit('message', request(1))
  await flush()
  expect(state.gcSample).toHaveBeenCalledOnce()
  state.process.emit('message', cancel(1, new Error('cancelled while sampling')))
  sampling.resolve({})
  await flush()
  expect(state.resourceSample).not.toHaveBeenCalled()
  expect(state.process.send).toHaveBeenCalledWith({ id: 1, error: expect.objectContaining({ message: 'cancelled while sampling' }) })
  state.process.emit('message', { type: 'close' })
  await flush()
})

it('does not publish success when cancellation arrives during timer-turn resource sampling', async () => {
  const sampling = Promise.withResolvers<unknown>()
  state.resourceSample.mockReturnValueOnce(sampling.promise)
  state.session.observe.mockResolvedValue('observed')
  state.process.emit('message', request(1))
  await flush()
  expect(state.gcSample).toHaveBeenCalledBefore(state.resourceSample)
  expect(state.resourceSample).toHaveBeenCalledOnce()
  state.process.emit('message', cancel(1, new Error('cancelled during resource sampling')))
  sampling.resolve({})
  await flush()
  expect(state.process.send).toHaveBeenCalledExactlyOnceWith({ id: 1, error: expect.objectContaining({ message: 'cancelled during resource sampling' }) })
  state.process.emit('message', { type: 'close' })
  await flush()
})
