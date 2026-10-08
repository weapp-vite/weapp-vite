import type { CompileRequest, CompileResponse, CompileSample, CompileScenario } from './compileProtocol'
import { EventEmitter } from 'node:events'
import process from 'node:process'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createCompileProcess } from './compileProcess'

const { fork } = vi.hoisted(() => ({ fork: vi.fn() }))
vi.mock('node:child_process', () => ({ fork }))

class FakeChild extends EventEmitter {
  pid: number | undefined = process.pid
  stderr = new EventEmitter()
  send = vi.fn((_request: CompileRequest, callback?: (error: Error | null) => void) => {
    callback?.(null)
    return true
  })

  // Node 的 kill 成功只表示信号已发送，不表示进程已退出；测试单独控制 exit。
  kill = vi.fn((_signal?: NodeJS.Signals) => true)

  reply(response: CompileResponse) {
    this.emit('message', response)
  }

  lastRequest() {
    const request = this.send.mock.lastCall?.[0]
    if (!request) {
      throw new Error('Expected an IPC request')
    }
    return request
  }
}

const scenario: CompileScenario = { id: 'simple-page', filename: 'page.vue', source: '<template><view /></template>', options: {} }
const sample: CompileSample = { output: '{}', wallMs: 1, cpuMicroseconds: 1, rssAfterBytes: 1, failed: false, metrics: {} }

function observeSettlement(promise: Promise<unknown>) {
  const state = { settled: false }
  void promise.then(() => {
    state.settled = true
  }, () => {
    state.settled = true
  })
  return state
}

async function open(child: FakeChild) {
  fork.mockReturnValueOnce(child)
  const opening = createCompileProcess('baseline', 'binding.node')
  child.reply({ id: 0, kind: 'ready', sourceHashes: { compiler: 'fixed-source' } })
  return opening
}

beforeEach(() => {
  vi.useFakeTimers()
  fork.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('exchanges ready, compile and close messages, then waits for the owned child to exit', async () => {
  const child = new FakeChild()
  const compiler = await open(child)
  expect(fork).toHaveBeenCalledWith(expect.stringMatching(/compileWorker\.ts$/), ['baseline', 'binding.node'], expect.objectContaining({
    execPath: process.execPath,
    execArgv: ['--import', 'tsx'],
    env: expect.objectContaining({ WEAPP_VITE_NATIVE: '0' }),
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  }))
  expect(compiler.ready).toMatchObject({ kind: 'ready', sourceHashes: { compiler: 'fixed-source' } })
  const compiling = compiler.compile(scenario)
  const request = child.lastRequest()
  expect(request).toMatchObject({ kind: 'compile', scenario })
  child.reply({ id: request.id, kind: 'result', result: sample })
  await expect(compiling).resolves.toEqual(sample)

  const closing = compiler.close()
  const state = observeSettlement(closing)
  const closeRequest = child.lastRequest()
  expect(closeRequest.kind).toBe('close')
  child.reply({ id: closeRequest.id, kind: 'closed' })
  await vi.advanceTimersByTimeAsync(0)
  expect(child.kill).toHaveBeenCalledExactlyOnceWith('SIGTERM')
  expect(state.settled).toBe(false)
  child.emit('exit', 0, null)
  await closing
  expect(vi.getTimerCount()).toBe(0)
  await compiler.close()
  expect(child.kill).toHaveBeenCalledOnce()
})

it('rejects a spawn failure without a pid and does not signal a process that was never created', async () => {
  const child = new FakeChild()
  child.pid = undefined
  fork.mockReturnValueOnce(child)
  const opening = createCompileProcess('baseline', 'binding.node')
  const failure = new Error('Executable could not be spawned')
  const rejected = expect(opening).rejects.toBe(failure)
  child.emit('error', failure)
  await rejected
  expect(child.send).not.toHaveBeenCalled()
  expect(child.kill).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})

it('retains ownership after an error with a pid until exit is confirmed, including signal escalation', async () => {
  const child = new FakeChild()
  fork.mockReturnValueOnce(child)
  const opening = createCompileProcess('baseline', 'binding.node')
  const state = observeSettlement(opening)
  const failure = new Error('IPC failed during startup after the process was spawned')
  const rejected = expect(opening).rejects.toBe(failure)
  child.emit('error', failure)
  await vi.advanceTimersByTimeAsync(0)
  expect(child.kill).toHaveBeenCalledExactlyOnceWith('SIGTERM')
  expect(state.settled).toBe(false)
  await vi.advanceTimersByTimeAsync(5000)
  expect(child.kill.mock.calls.map(([signal]) => signal)).toEqual(['SIGTERM', 'SIGKILL'])
  expect(state.settled).toBe(false)
  child.emit('exit', null, 'SIGKILL')
  await rejected
  expect(vi.getTimerCount()).toBe(0)
})

it('cleans up only the failing compiler after a live-process error and close delivery failure', async () => {
  const child = new FakeChild()
  const unrelated = new FakeChild()
  const compiler = await open(child)
  const otherCompiler = await open(unrelated)
  const failure = new Error('IPC channel failed while the compiler remained alive')
  const compiling = compiler.compile(scenario)
  const rejectedCompile = expect(compiling).rejects.toBe(failure)
  child.emit('error', failure)
  await rejectedCompile

  const closeFailure = new Error('The close message could not be delivered')
  child.send.mockImplementationOnce((_request, callback) => {
    callback?.(closeFailure)
    return false
  })
  const closing = compiler.close()
  const state = observeSettlement(closing)
  const rejectedClose = expect(closing).rejects.toBe(closeFailure)
  await vi.advanceTimersByTimeAsync(0)
  expect(child.lastRequest().kind).toBe('close')
  expect(child.kill).toHaveBeenCalledExactlyOnceWith('SIGTERM')
  expect(state.settled).toBe(false)
  child.emit('error', new Error('A later signal or IPC error still does not confirm exit'))
  await vi.advanceTimersByTimeAsync(0)
  expect(state.settled).toBe(false)
  expect(unrelated.kill).not.toHaveBeenCalled()
  expect(unrelated.send).not.toHaveBeenCalled()
  child.emit('exit', null, 'SIGTERM')
  await rejectedClose

  const otherCompilation = otherCompiler.compile(scenario)
  unrelated.reply({ id: unrelated.lastRequest().id, kind: 'result', result: sample })
  await expect(otherCompilation).resolves.toEqual(sample)
  const otherClosing = otherCompiler.close()
  unrelated.reply({ id: unrelated.lastRequest().id, kind: 'closed' })
  await vi.advanceTimersByTimeAsync(0)
  unrelated.emit('exit', 0, null)
  await otherClosing
  expect(vi.getTimerCount()).toBe(0)
})
