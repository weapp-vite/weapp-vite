import type { ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { afterEach, expect, it, vi } from 'vitest'
import { crashDevProcess } from './crash'

function fixture() {
  const native = Object.assign(new EventEmitter(), {
    exitCode: null as number | null,
    signalCode: null as string | null,
    kill: vi.fn(() => true),
  })
  native.on('error', () => {})
  const capture = vi.fn(async () => {})
  const isRootHeld = vi.fn(() => native.exitCode === null && native.signalCode === null)
  const onSignal = vi.fn()
  const options = { root: native as unknown as ChildProcess, capture, isRootHeld, onSignal }
  const exit = () => {
    native.signalCode = 'SIGKILL'
    native.emit('exit', null, 'SIGKILL')
  }
  return { native, capture, isRootHeld, onSignal, options, exit }
}

afterEach(() => vi.useRealTimers())

it('completes registration before signalling and waits for native exit independently from output', async () => {
  const ctx = fixture()
  const captured = Promise.withResolvers<void>()
  ctx.capture.mockReturnValue(captured.promise)
  let completed = false
  const crashed = crashDevProcess(ctx.options, 1_000).finally(() => completed = true)
  expect(ctx.native.kill).not.toHaveBeenCalled()
  captured.resolve()
  await new Promise(resolve => setImmediate(resolve))
  expect(ctx.capture).toHaveBeenCalledExactlyOnceWith(1_000)
  expect(ctx.native.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL')
  expect(ctx.onSignal).toHaveBeenCalledOnce()
  expect(completed).toBe(false)
  ctx.native.emit('error', new Error('a send error does not prove process exit'))
  expect(completed).toBe(false)
  ctx.exit()
  await crashed
  expect(ctx.native.listenerCount('exit')).toBe(0)
})

it('rechecks the held root after asynchronous registration and refuses an exited generation', async () => {
  const ctx = fixture()
  ctx.capture.mockImplementation(async () => ctx.exit())
  await expect(crashDevProcess(ctx.options, 0)).rejects.toThrow('root exited before')
  expect(ctx.native.kill).not.toHaveBeenCalled()
  expect(ctx.onSignal).not.toHaveBeenCalled()
})

it('does not mark a rejected native kill as a completed crash', async () => {
  const ctx = fixture()
  ctx.native.kill.mockReturnValue(false)
  await expect(crashDevProcess(ctx.options, 0)).rejects.toThrow('held child handle')
  expect(ctx.onSignal).not.toHaveBeenCalled()
  expect(ctx.native.listenerCount('exit')).toBe(0)
})

it('reports an unconfirmed native exit and releases its temporary observer', async () => {
  vi.useFakeTimers()
  const ctx = fixture()
  const crashed = crashDevProcess(ctx.options, 100)
  const result = Promise.allSettled([crashed])
  await vi.runAllTimersAsync()
  expect((await result)[0]).toMatchObject({ status: 'rejected', reason: { message: expect.stringContaining('native exit was not confirmed') } })
  expect(ctx.native.listenerCount('exit')).toBe(0)
})
