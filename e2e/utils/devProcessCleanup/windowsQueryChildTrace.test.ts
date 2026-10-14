import { Buffer } from 'node:buffer'
import { ChildProcess } from 'node:child_process'
import process from 'node:process'
import { PassThrough } from 'node:stream'
// eslint-disable-next-line e18e/ban-dependencies -- 只核验 Execa 公开 Node 句柄契约，不启动 E2E、IDE 或服务。
import { execa } from 'execa'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { traceWindowsQueryChild } from './windowsQueryChildTrace'

function createSubprocess(pid?: number) {
  const child = new ChildProcess()
  Object.assign(child, { pid, stdout: new PassThrough(), stderr: new PassThrough() })
  let resolve!: (value: object) => void
  let reject!: (error: unknown) => void
  const subprocess = Object.assign(new Promise<object>((accept, fail) => {
    resolve = accept
    reject = fail
  }), { nodeChildProcess: child })
  return { child, subprocess, resolve, reject }
}

afterEach(() => vi.restoreAllMocks())

describe('Windows query Node child diagnostic', () => {
  it('records Node events and only the first output timing without changing streams or results', async () => {
    const output = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    let now = 10
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const { child, subprocess, resolve } = createSubprocess(83)
    const consumer = vi.fn()
    child.stdout!.on('data', consumer)
    const observed = traceWindowsQueryChild('snapshot', subprocess, now)
    now = 12
    child.emit('spawn')
    now = 15
    const chunk = Buffer.from('private process output')
    child.stdout!.emit('data', chunk)
    child.stdout!.emit('data', chunk)
    now = 18
    child.stderr!.emit('data', Buffer.from('private provider error'))
    now = 30
    child.emit('exit', 1, null)
    now = 40
    child.emit('close', 1, null)
    const result = { exitCode: 1, stdout: 'unchanged output' }
    resolve(result)
    expect(await observed).toBe(result)
    const reports = output.mock.calls.map(([line]) => JSON.parse(String(line).slice('[e2e-cleanup-query-child] '.length)) as unknown)
    expect(reports).toEqual([
      { query: 'snapshot', event: 'handle', pid: 83, elapsedMs: 0 },
      { query: 'snapshot', event: 'spawn', pid: 83, elapsedMs: 2 },
      { query: 'snapshot', event: 'first-stdout', pid: 83, elapsedMs: 5 },
      { query: 'snapshot', event: 'first-stderr', pid: 83, elapsedMs: 8 },
      { query: 'snapshot', event: 'exit', pid: 83, elapsedMs: 20, exitCode: 1, signalled: false },
      { query: 'snapshot', event: 'close', pid: 83, elapsedMs: 30, exitCode: 1, signalled: false },
    ])
    expect(consumer).toHaveBeenCalledTimes(2)
    expect(consumer).toHaveBeenNthCalledWith(1, chunk)
    expect(child.stdout!.listeners('data')).toEqual([consumer])
    expect(child.stderr!.listenerCount('data')).toBe(0)
    expect(child.eventNames()).toEqual([])
    expect(output.mock.calls.flat().join('')).not.toContain('private')
  })

  it('distinguishes a spawn error from an observed spawn without exposing the error', async () => {
    const output = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    const { child, subprocess, resolve } = createSubprocess()
    const observed = traceWindowsQueryChild('identities', subprocess, performance.now())
    child.emit('error', Object.assign(new Error('private command detail'), { code: 'ENOENT' }))
    child.emit('close', null, null)
    const result = { exitCode: undefined, timedOut: false }
    resolve(result)
    expect(await observed).toBe(result)
    const reports = output.mock.calls.map(([line]) => JSON.parse(String(line).slice('[e2e-cleanup-query-child] '.length)) as unknown)
    expect(reports).toEqual([
      { query: 'identities', event: 'handle', pid: null, elapsedMs: expect.any(Number) },
      { query: 'identities', event: 'error', pid: null, elapsedMs: expect.any(Number) },
      { query: 'identities', event: 'close', pid: null, elapsedMs: expect.any(Number), exitCode: null, signalled: false },
    ])
    expect(output.mock.calls.flat().join('')).not.toMatch(/private|ENOENT/)
    expect(child.eventNames()).toEqual([])
  })

  it('does not wait for close after the original result settles, but still observes it', async () => {
    const output = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    const { child, subprocess, resolve } = createSubprocess(83)
    const observed = traceWindowsQueryChild('snapshot', subprocess, performance.now())
    const result = { timedOut: true }
    resolve(result)
    expect(await observed).toBe(result)
    expect(child.eventNames()).toEqual(['close'])
    expect(child.stdout!.listenerCount('data')).toBe(0)
    expect(child.stderr!.listenerCount('data')).toBe(0)
    child.emit('close', null, 'SIGTERM')
    expect(String(output.mock.calls.at(-1)![0])).toContain('"event":"close"')
    expect(String(output.mock.calls.at(-1)![0])).toContain('"signalled":true')
    expect(child.eventNames()).toEqual([])
  })

  it('preserves the original rejection and removes its stream observers', async () => {
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    const { child, subprocess, reject } = createSubprocess(83)
    const observed = traceWindowsQueryChild('snapshot', subprocess, performance.now())
    const error = new Error('original query failure')
    reject(error)
    await expect(observed).rejects.toBe(error)
    expect(child.eventNames()).toEqual(['close'])
    expect(child.stdout!.listenerCount('data')).toBe(0)
    child.emit('close', null, null)
    expect(child.eventNames()).toEqual([])
  })

  it('preserves queries if diagnostic output or listener registration fails', async () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => {
      throw new Error('closed diagnostic stream')
    })
    const first = createSubprocess(83)
    const observed = traceWindowsQueryChild('snapshot', first.subprocess, performance.now())
    first.child.emit('spawn')
    first.child.emit('close', 0, null)
    const result = { exitCode: 0 }
    first.resolve(result)
    expect(await observed).toBe(result)
    const second = createSubprocess(83)
    vi.spyOn(second.child, 'once').mockImplementationOnce(() => {
      throw new Error('diagnostic listener unavailable')
    })
    expect(traceWindowsQueryChild('identities', second.subprocess, performance.now())).toBe(second.subprocess)
    second.resolve(result)
    expect(await second.subprocess).toBe(result)
    expect(second.child.eventNames()).toEqual([])
  })

  it('observes the actual Execa Node child handle while preserving its public output', async () => {
    const output = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    const startedMs = performance.now()
    const subprocess = execa(process.execPath, ['-e', 'process.stdout.write("trace public stdout\\n"); process.stderr.write("trace public stderr\\n")'], { timeout: 5_000, reject: false })
    const child = subprocess.nodeChildProcess
    const closed = new Promise<void>(resolve => child.once('close', () => resolve()))
    const result = await traceWindowsQueryChild('snapshot', subprocess, startedMs)
    await closed
    expect(result).toBe(await subprocess)
    expect(result).toMatchObject({ exitCode: 0, stdout: 'trace public stdout', stderr: 'trace public stderr' })
    const reports = output.mock.calls.map(([line]) => JSON.parse(String(line).slice('[e2e-cleanup-query-child] '.length)) as { event: string, pid: number, elapsedMs: number })
    expect(reports.map(report => report.event).toSorted()).toEqual(['close', 'exit', 'first-stderr', 'first-stdout', 'handle', 'spawn'])
    expect(reports.every(report => report.pid === subprocess.pid && Number.isFinite(report.elapsedMs) && report.elapsedMs >= 0)).toBe(true)
    for (const event of ['spawn', 'error', 'exit', 'close']) {
      expect(child.listenerCount(event)).toBe(0)
    }
    expect(child.stdout?.listeners('data').some(listener => listener.name === 'onStdout')).toBe(false)
    expect(child.stderr?.listeners('data').some(listener => listener.name === 'onStderr')).toBe(false)
    expect(output.mock.calls.flat().join('')).not.toMatch(/trace public stdout|trace public stderr/)
  })
})
