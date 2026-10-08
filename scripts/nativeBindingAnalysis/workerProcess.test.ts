import type { WorkerRequest, WorkerResponse } from './workerProcess'
import { EventEmitter } from 'node:events'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createWorkerProcess } from './workerProcess'

const { fork } = vi.hoisted(() => ({ fork: vi.fn() }))
vi.mock('node:child_process', () => ({ fork }))

interface Payload { input: { source: string } }
interface Ready { id: number, kind: 'ready', schemaVersion: number }
interface Result { digest: string }

class FakeChild extends EventEmitter {
  pid = process.pid
  stderr = new EventEmitter()
  send = vi.fn((_request: WorkerRequest<Payload>, callback?: (error: Error | null) => void) => {
    callback?.(null)
    return true
  })

  kill = vi.fn((_signal?: NodeJS.Signals) => true)

  reply(response: WorkerResponse<Ready, Result>) {
    this.emit('message', response)
  }

  lastRequest() {
    return this.send.mock.lastCall![0]
  }
}

const options = {
  worker: new URL('./workerProcess.ts', import.meta.url),
  args: ['input with spaces', 'unicode-输入'],
  label: 'Script worker',
  env: { WEAPP_VITE_TEST_WORKER: 'isolated' },
}
const payload: Payload = { input: { source: 'export default {}' } }

function start(child: FakeChild) {
  fork.mockReturnValueOnce(child)
  return createWorkerProcess<Payload, Ready, Result>(options)
}

async function open(child: FakeChild) {
  const opening = start(child)
  child.reply({ id: 0, kind: 'ready', schemaVersion: 2 })
  return opening
}

async function close(worker: Awaited<ReturnType<typeof open>>, child: FakeChild) {
  const closing = worker.close()
  child.reply({ id: child.lastRequest().id, kind: 'closed' })
  await vi.advanceTimersByTimeAsync(0)
  child.emit('exit', 0, null)
  await closing
}

beforeEach(() => {
  vi.useFakeTimers()
  fork.mockReset()
})

afterEach(() => {
  expect(vi.getTimerCount()).toBe(0)
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('transports caller-specific readiness, payloads and results through the configured Node worker', async () => {
  const child = new FakeChild()
  const worker = await open(child)
  expect(fork).toHaveBeenCalledWith(fileURLToPath(options.worker), options.args, expect.objectContaining({
    execPath: process.execPath,
    execArgv: ['--import', 'tsx'],
    env: expect.objectContaining(options.env),
  }))
  expect(worker.ready).toEqual({ id: 0, kind: 'ready', schemaVersion: 2 })
  const compiling = worker.compile(payload)
  expect(child.lastRequest()).toEqual({ id: 1, kind: 'compile', ...payload })
  child.reply({ id: 1, kind: 'result', result: { digest: 'compiled' } })
  await expect(compiling).resolves.toEqual({ digest: 'compiled' })
  await close(worker, child)
})

it('rejects overlapping requests without displacing the pending request and forwards worker errors', async () => {
  const child = new FakeChild()
  const worker = await open(child)
  const first = worker.compile(payload)
  const rejected = expect(first).rejects.toThrow('Compilation failed')
  await expect(worker.compile(payload)).rejects.toThrow('not available for a serial request')
  expect(child.send).toHaveBeenCalledOnce()
  child.reply({ id: child.lastRequest().id, kind: 'error', message: 'Compilation failed' })
  await rejected
  const next = worker.compile(payload)
  child.reply({ id: child.lastRequest().id, kind: 'result', result: { digest: 'recovered' } })
  await expect(next).resolves.toEqual({ digest: 'recovered' })
  await close(worker, child)
})

it('cleans up a startup timeout and waits for exit after escalating only the owned child', async () => {
  const child = new FakeChild()
  const opening = start(child)
  const rejected = expect(opening).rejects.toThrow('Script worker request timed out')
  await vi.advanceTimersByTimeAsync(120_000)
  expect(child.kill).toHaveBeenCalledExactlyOnceWith('SIGTERM')
  await vi.advanceTimersByTimeAsync(5000)
  expect(child.kill.mock.calls.map(([signal]) => signal)).toEqual(['SIGTERM', 'SIGKILL'])
  child.emit('exit', null, 'SIGKILL')
  await rejected
})

it('retains an active worker after a request timeout until the caller closes it', async () => {
  const child = new FakeChild()
  const worker = await open(child)
  const compiling = worker.compile(payload)
  const rejected = expect(compiling).rejects.toThrow('Script worker request timed out')
  await vi.advanceTimersByTimeAsync(120_000)
  await rejected
  expect(child.kill).not.toHaveBeenCalled()
  await close(worker, child)
})

it('rejects mismatched response ids through owned-process termination and reports its stderr', async () => {
  const child = new FakeChild()
  const worker = await open(child)
  const compiling = worker.compile(payload)
  const rejected = expect(compiling).rejects.toThrow('Script worker exited: 2; worker diagnostic')
  child.stderr.emit('data', 'worker diagnostic')
  child.reply({ id: child.lastRequest().id + 1, kind: 'result', result: { digest: 'wrong-request' } })
  expect(child.kill).toHaveBeenCalledExactlyOnceWith('SIGTERM')
  child.emit('exit', 2, null)
  await rejected
  await worker.close()
  expect(child.kill).toHaveBeenCalledOnce()
})

it('reports cleanup failure when an owned child never confirms exit', async () => {
  const child = new FakeChild()
  const worker = await open(child)
  const closing = worker.close()
  const rejected = expect(closing).rejects.toThrow('Script worker did not confirm exit after owned-process cleanup')
  child.reply({ id: child.lastRequest().id, kind: 'closed' })
  await vi.advanceTimersByTimeAsync(10_000)
  await rejected
  expect(child.kill.mock.calls.map(([signal]) => signal)).toEqual(['SIGTERM', 'SIGKILL'])
  child.emit('exit', null, 'SIGKILL')
})
