import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupTrackedDevProcesses, startDevProcess } from './dev-process'
import { createProcessTreeFixture } from './devProcessCleanupFixture'
import { fixtureWindowsProcessRows } from './testSupport/windowsProcessRows'

const execaMock = vi.hoisted(() => vi.fn())
const kernelQueryMock = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: execaMock }))
vi.mock('./devProcessCleanup/windowsKernelArtifact', () => ({ assertWindowsKernelInspectorReady: vi.fn() }))
vi.mock('./devProcessDiagnostics', () => ({ createDevProcessDiagnostics: () => ({ write() {}, flush() {} }) }))
vi.mock('./devProcessCleanup/windowsKernelQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./devProcessCleanup/windowsKernelQuery')>()
  return { ...actual, queryWindowsKernelProcesses: kernelQueryMock }
})

let fixture: ReturnType<typeof createProcessTreeFixture>

beforeEach(() => {
  vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
  fixture = createProcessTreeFixture(execaMock)
  kernelQueryMock.mockImplementation(fixture.queryWindows)
})

afterEach(async () => {
  fixture.finish()
  await cleanupTrackedDevProcesses(0)
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('registered dev process crash', () => {
  it.each([false, true])('registers before a held-handle crash and drains only registered descendants (concurrent stop=%s)', async (concurrentStop) => {
    const snapshot = Promise.withResolvers<void>()
    kernelQueryMock.mockImplementationOnce(async () => {
      await snapshot.promise
      return fixture.queryWindows()
    })
    const root = fixture.processes.get(61)!
    const external = { ...root, pid: 81, ppid: 61, started: '2026-10-05T12:30:00.0000000Z' }
    // 旧父代次的 PPID 可与当前根 PID 相同；其后代也不能获得清理权。
    fixture.processes.set(81, external)
    fixture.processes.set(82, { ...root, pid: 82, ppid: 81, started: '2026-10-05T12:30:03.0000000Z' })
    const failure = Object.assign(new Error('held root was deliberately crashed'), { exitCode: 1, signal: 'SIGKILL' })
    const { pid, all, nodeChildProcess } = fixture.owned.child
    execaMock.mockImplementationOnce(() => Object.assign(fixture.owned.child.then(() => {
      throw failure
    }), { pid, all, nodeChildProcess }))
    const kill = vi.fn(() => {
      expect(kernelQueryMock).toHaveBeenCalledExactlyOnceWith(undefined, expect.any(Boolean))
      fixture.processes.delete(61)
      nodeChildProcess.exitCode = 1
      return true
    })
    Object.assign(nodeChildProcess, { kill })
    fixture.afterSignal = (candidate) => {
      if (candidate === 62) {
        all.emit('data', 'final crashed descendant diagnostic')
        fixture.owned.settle()
      }
    }
    const dev = startDevProcess('node', ['fixture.js'], { ipc: true })
    const crashing = dev.crash()
    expect(dev.crash()).toBe(crashing)
    const stopping = concurrentStop ? dev.stop(0) : undefined
    const concurrentOutcome = stopping?.catch((error: unknown) => error)
    try {
      await new Promise(resolve => setImmediate(resolve))
      expect(kill).not.toHaveBeenCalled()
      expect(fixture.signals).toEqual([])
      expect(execaMock.mock.calls.some(([command]) => command === 'taskkill')).toBe(false)
    }
    finally {
      snapshot.resolve()
    }
    await crashing
    expect(kill).toHaveBeenCalledExactlyOnceWith('SIGKILL')
    const stopTask = stopping ?? dev.stop(0)
    const stopped: unknown = await (concurrentOutcome ?? stopTask.catch(error => error))
    expect(stopped).toMatchObject({ cause: failure, message: expect.stringContaining('Dev process failed during graceful shutdown:') })
    expect((stopped as Error).message).toContain('final crashed descendant diagnostic')
    expect(dev.stop(0)).toBe(stopTask)
    await expect(dev.stop(0)).rejects.toBe(stopped)
    expect(execaMock.mock.calls.filter(([command]) => command === 'taskkill')).toEqual([
      ['taskkill', ['/PID', '62', '/F'], expect.objectContaining({ reject: false })],
    ])
    expect(kernelQueryMock.mock.calls.filter(([pids]) => pids === undefined)).toHaveLength(1)
    expect([...fixture.processes.keys()]).toEqual([71, 72, 81, 82])
    await expect(cleanupTrackedDevProcesses(0)).resolves.toBeUndefined()
  })

  it('rejects an incomplete registration before sending a crash signal and permits independent cleanup retry', async () => {
    const inspection = new Error('snapshot is incomplete')
    kernelQueryMock.mockRejectedValueOnce(inspection)
    const kill = vi.fn(() => true)
    Object.assign(fixture.owned.child.nodeChildProcess, { kill })
    const dev = startDevProcess('node', ['fixture.js'])
    const crashing = dev.crash()
    await expect(crashing).rejects.toBe(inspection)
    expect(dev.crash()).toBe(crashing)
    expect(kill).not.toHaveBeenCalled()
    expect(fixture.signals).toEqual([])
    await dev.stop(0)
    expect([...fixture.processes.keys()]).toEqual([71, 72])
  })

  it('does not initiate a crash once shutdown has started', async () => {
    const kill = vi.fn(() => true)
    Object.assign(fixture.owned.child.nodeChildProcess, { kill })
    const dev = startDevProcess('node', ['fixture.js'])
    const stopping = dev.stop(0)
    await expect(dev.crash()).rejects.toThrow('after shutdown has started')
    await stopping
    expect(kill).not.toHaveBeenCalled()
  })

  it('keeps shutdown one-way after a failed stop while permitting ownership cleanup retry', async () => {
    const inspection = new Error('the first stop could not inspect its tree')
    kernelQueryMock.mockRejectedValueOnce(inspection)
    const kill = vi.fn(() => true)
    Object.assign(fixture.owned.child.nodeChildProcess, { kill })
    const dev = startDevProcess('node', ['fixture.js'])
    await expect(dev.stop(0)).rejects.toBe(inspection)
    await expect(dev.crash()).rejects.toThrow('after shutdown has started')
    expect(kill).not.toHaveBeenCalled()
    expect(fixture.signals).toEqual([])
    await dev.stop(0)
    expect([...fixture.processes.keys()]).toEqual([71, 72])
  })

  it('preserves unknown descendants across crash failure and stop retries after root exit', async () => {
    const rows = [...fixture.processes.values()].map(entry => ({
      ProcessId: entry.pid,
      ParentProcessId: entry.ppid,
      Started: entry.started,
      ExecutablePath: entry.pid === 62 ? null : entry.executable,
    }))
    kernelQueryMock.mockResolvedValueOnce({ exitCode: 0, stdout: fixtureWindowsProcessRows(rows), stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: fixtureWindowsProcessRows(rows.filter(entry => entry.ProcessId === 62)), stderr: '' })
    const kill = vi.fn(() => true)
    Object.assign(fixture.owned.child.nodeChildProcess, { kill })
    const dev = startDevProcess('node', ['fixture.js'])
    await expect(dev.crash()).rejects.toMatchObject({ pids: [62] })
    fixture.processes.delete(61)
    fixture.owned.exitNative()
    for (let retry = 0; retry < 2; retry++) {
      await expect(dev.stop(0)).rejects.toMatchObject({ pids: [62] })
    }
    expect(kill).not.toHaveBeenCalled()
    expect(fixture.signals).toEqual([])
    fixture.processes.delete(62)
    fixture.owned.settle()
    await dev.stop(0)
    expect([...fixture.processes.keys()]).toEqual([71, 72])
  })
})
