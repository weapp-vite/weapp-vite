import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupTrackedDevProcesses, startDevProcess } from './dev-process'
import { cleanupResidualDevProcesses } from './dev-process-cleanup'
import { DEV_PROCESS_GRACEFUL_TIMEOUT_MS, DevProcessGracefulShutdownError } from './devProcessCleanup/shutdown'
import { createChild, createProcessTreeFixture } from './devProcessCleanupFixture'

const execaMock = vi.hoisted(() => vi.fn())
const kernelQueryMock = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: execaMock }))
vi.mock('./devProcessDiagnostics', () => ({ createDevProcessDiagnostics: () => ({ write() {}, flush() {} }) }))
vi.mock('./devProcessCleanup/windowsKernelQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./devProcessCleanup/windowsKernelQuery')>()
  return { ...actual, queryWindowsKernelProcesses: kernelQueryMock }
})

const fixtures = new Set<ReturnType<typeof createProcessTreeFixture>>()

function mockProcessTree() {
  const fixture = createProcessTreeFixture(execaMock)
  kernelQueryMock.mockImplementation(fixture.queryWindows)
  fixtures.add(fixture)
  return fixture
}

async function settleCleanup(pending: Promise<void>) {
  const result = Promise.allSettled([pending])
  await vi.runAllTimersAsync()
  return (await result)[0]!
}

describe('dev process cleanup ownership', () => {
  beforeEach(() => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
  })

  afterEach(async () => {
    for (const fixture of fixtures) {
      fixture.finish()
    }
    fixtures.clear()
    await cleanupTrackedDevProcesses(0)
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it.each([
    ['node', undefined, true],
    ['NODE.EXE', undefined, true],
    ['C:\\Program Files\\nodejs\\node.exe', undefined, true],
    [process.execPath, undefined, true],
    ['node', false, false],
    ['pnpm', undefined, false],
    ['bun', undefined, false],
  ] as const)('chooses a graceful channel for %s with override=%s', async (command, ipc, expected) => {
    const owned = createChild()
    execaMock.mockReturnValue(owned.child)
    const dev = startDevProcess(command, [], ipc === undefined ? undefined : { ipc })
    expect(execaMock).toHaveBeenCalledWith(command, [], expect.objectContaining({ ipc: expected }))
    owned.exit()
    await dev.stop(0)
  })

  it('releases registered children once while preserving identical unowned commands', async () => {
    vi.useFakeTimers()
    const fixture = mockProcessTree()
    fixture.ignoreTermPids.clear()
    const dev = startDevProcess('node', ['fixture.js'])
    const stopping = Promise.all([dev.stop(0), cleanupTrackedDevProcesses(0), dev.stop(0)])
    await vi.runAllTimersAsync()
    await stopping
    await cleanupResidualDevProcesses()
    expect(fixture.signals).toEqual([{ pid: 62, signal: 'SIGTERM' }, { pid: 61, signal: 'SIGTERM' }])
    expect([...fixture.processes.keys()]).toEqual([71, 72])
  })

  it('does not use an exited child PID after it could have been reused', async () => {
    const owned = createChild()
    execaMock.mockReturnValue(owned.child)
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true)
    const dev = startDevProcess('pnpm', ['run', 'dev'])
    owned.exit()
    await dev.stop(0)
    await cleanupTrackedDevProcesses(0)
    expect(kill).not.toHaveBeenCalled()
    expect(execaMock).toHaveBeenCalledOnce()
  })

  it('reports unconfirmed descendant ownership when the root exits during discovery', async () => {
    const fixture = mockProcessTree()
    fixture.afterDiscovery = () => fixture.finish()
    const dev = startDevProcess('node', ['fixture.js'])
    await expect(dev.stop(0)).rejects.toThrow('ownership remains unconfirmed')
    expect(fixture.signals).toEqual([])
    await cleanupTrackedDevProcesses(0)
  })

  it('retains unconfirmed descendants without signalling them until they are observed gone', async () => {
    const fixture = mockProcessTree()
    fixture.afterDiscovery = () => {
      fixture.processes.delete(61)
      fixture.owned.exit()
    }
    const dev = startDevProcess('node', ['fixture.js'])
    await expect(dev.stop(0)).rejects.toThrow('ownership remains unconfirmed')
    await expect(cleanupTrackedDevProcesses(0)).rejects.toThrow('ownership remains unconfirmed')
    expect(fixture.signals).toEqual([])
    fixture.processes.delete(62)
    await cleanupTrackedDevProcesses(0)
    expect([...fixture.processes.keys()]).toEqual([71, 72])
  })

  it('does not inspect or kill unregistered processes', async () => {
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true)
    await cleanupResidualDevProcesses()
    expect(execaMock).not.toHaveBeenCalled()
    expect(kernelQueryMock).not.toHaveBeenCalled()
    expect(kill).not.toHaveBeenCalled()
  })

  it('finishes a registered descendant that ignores TERM after the owned root exits', async () => {
    vi.useFakeTimers()
    const fixture = mockProcessTree()
    const dev = startDevProcess('node', ['fixture.js'])
    expect(await settleCleanup(dev.stop(100))).toEqual({ status: 'fulfilled', value: undefined })
    expect(fixture.signals).toEqual([
      { pid: 62, signal: 'SIGTERM' },
      { pid: 61, signal: 'SIGTERM' },
      { pid: 62, signal: 'SIGKILL' },
    ])
    expect(fixture.identityReads.filter(entry => entry.pid === 62).length).toBeGreaterThanOrEqual(2)
    expect([...fixture.processes.keys()]).toEqual([71, 72])
  })

  it('does not adopt a descendant PID reused by an external process during discovery', async () => {
    vi.useFakeTimers()
    const fixture = mockProcessTree()
    fixture.afterDiscovery = () => fixture.processes.set(62, {
      ...fixture.processes.get(62)!,
      ppid: 21,
      started: 'Mon Oct 5 12:30:05 2026',
    })
    const dev = startDevProcess('node', ['fixture.js'])
    const failed = await settleCleanup(dev.stop(100))
    expect(failed).toMatchObject({ status: 'rejected', reason: expect.any(Error) })
    expect(fixture.signals).toEqual([])
    fixture.afterDiscovery = undefined
    expect(await settleCleanup(cleanupTrackedDevProcesses(100))).toEqual({ status: 'fulfilled', value: undefined })
    expect([...fixture.processes.keys()]).toEqual([62, 71, 72])
  })

  it.each(['started', 'executable'] as const)('preserves a registered PID whose %s changes before escalation', async (field) => {
    vi.useFakeTimers()
    const fixture = mockProcessTree()
    fixture.ignoreTermPids.add(61)
    const replacement = {
      ...fixture.processes.get(62)!,
      [field]: field === 'started' ? 'Mon Oct 5 12:30:05 2026' : path.posix.join('/', 'fixture', 'replacement-node'),
    }
    fixture.afterSignal = (pid, signal) => {
      if (pid === 61 && signal === 'SIGTERM') {
        fixture.processes.set(62, replacement)
      }
    }
    const dev = startDevProcess('node', ['fixture.js'])
    expect(await settleCleanup(dev.stop(100))).toEqual({ status: 'fulfilled', value: undefined })
    expect(fixture.signals.filter(entry => entry.pid === 62)).toEqual([{ pid: 62, signal: 'SIGTERM' }])
    expect(fixture.identityReads).toContainEqual(replacement)
    expect([...fixture.processes.keys()]).toEqual([62, 71, 72])
  })

  it('rejects incomplete cleanup, shares concurrent stop, and retains tracking for retry', async () => {
    vi.useFakeTimers()
    const fixture = mockProcessTree()
    fixture.blockedSignals.add(62)
    const dev = startDevProcess('node', ['fixture.js'])
    const firstStop = dev.stop(100)
    expect(dev.stop(100)).toBe(firstStop)
    const failed = await settleCleanup(firstStop)
    fixture.blockedSignals.clear()
    const retried = await settleCleanup(cleanupTrackedDevProcesses(100))
    expect(failed).toMatchObject({ status: 'rejected', reason: expect.any(Error) })
    expect(retried).toEqual({ status: 'fulfilled', value: undefined })
    expect([...fixture.processes.keys()]).toEqual([71, 72])
  })

  it('preserves descendants on an identity query failure and retries after inspection recovers', async () => {
    vi.useFakeTimers()
    const fixture = mockProcessTree()
    fixture.afterSignal = (pid, signal) => {
      if (pid === 61 && signal === 'SIGTERM') {
        fixture.unknownIdentityPids.add(62)
      }
    }
    const dev = startDevProcess('node', ['fixture.js'])
    const failed = await settleCleanup(dev.stop(100))
    const signalsBeforeRetry = [...fixture.signals]
    fixture.unknownIdentityPids.clear()
    const retried = await settleCleanup(cleanupTrackedDevProcesses(100))
    expect(failed).toMatchObject({ status: 'rejected', reason: expect.any(Error) })
    expect(signalsBeforeRetry.filter(entry => entry.pid === 62)).toEqual([{ pid: 62, signal: 'SIGTERM' }])
    expect(retried).toEqual({ status: 'fulfilled', value: undefined })
    expect([...fixture.processes.keys()]).toEqual([71, 72])
  })

  it('rejects a stdio drain timeout after native exit and permits cleanup retry', async () => {
    vi.useFakeTimers()
    const fixture = mockProcessTree()
    fixture.ignoreTermPids.clear()
    fixture.drainOutput = false
    const dev = startDevProcess('node', ['fixture.js'])
    const failed = await settleCleanup(dev.stop(100))
    expect(fixture.owned.child.nodeChildProcess.exitCode).toBe(0)
    fixture.owned.settle()
    const retried = await settleCleanup(cleanupTrackedDevProcesses(100))
    expect(failed).toMatchObject({ status: 'rejected', reason: expect.any(Error) })
    expect(retried).toEqual({ status: 'fulfilled', value: undefined })
    expect([...fixture.processes.keys()]).toEqual([71, 72])
  })

  it('drains registered descendants before reporting an IPC exit failure and unregisters completed cleanup', async () => {
    vi.useFakeTimers()
    const fixture = mockProcessTree()
    const failure = Object.assign(new Error('fixture shutdown cleanup failed'), { exitCode: 1, stderr: 'original cleanup error' })
    const { pid, all, nodeChildProcess } = fixture.owned.child
    const child = Object.assign(fixture.owned.child.then(() => {
      throw failure
    }), { pid, all, nodeChildProcess })
    execaMock.mockImplementationOnce(() => child)
    const disconnect = vi.fn(() => {
      fixture.processes.delete(pid)
      nodeChildProcess.exitCode = 1
    })
    Object.assign(nodeChildProcess, { connected: true, disconnect })
    fixture.afterSignal = (candidate, signal) => {
      if (candidate === 62 && signal === 'SIGKILL') {
        all.emit('data', 'final registered descendant output')
        fixture.owned.settle()
      }
    }
    const dev = startDevProcess('node', ['fixture.js'])
    const stopping = dev.stop(100)
    const result = await settleCleanup(stopping)
    expect(result).toMatchObject({
      status: 'rejected',
      reason: {
        name: 'DevProcessGracefulShutdownError',
        cause: failure,
        evidence: { gracefulTimeoutMs: DEV_PROCESS_GRACEFUL_TIMEOUT_MS },
        message: expect.stringContaining('exitCode=1, signal=none, reason=original cleanup error'),
      },
    })
    expect(result.status === 'rejected' && result.reason).toBeInstanceOf(DevProcessGracefulShutdownError)
    expect(result.status === 'rejected' && result.reason.cause).toBe(failure)
    expect(fixture.signals).toEqual([{ pid: 62, signal: 'SIGTERM' }, { pid: 62, signal: 'SIGKILL' }])
    expect([...fixture.processes.keys()]).toEqual([71, 72])
    expect(result.status === 'rejected' && result.reason.message).toContain('final registered descendant output')
    expect(disconnect).toHaveBeenCalledOnce()
    expect(dev.stop(100)).toBe(stopping)
    await expect(dev.stop(100)).rejects.toBe(result.status === 'rejected' ? result.reason : undefined)
    await expect(cleanupTrackedDevProcesses(0)).resolves.toBeUndefined()
  })

  it('retains forced root termination as an incomplete graceful shutdown after an IPC timeout', async () => {
    vi.useFakeTimers()
    const fixture = mockProcessTree()
    const failure = Object.assign(new Error('forced termination'), { exitCode: 1, signal: 'SIGTERM' })
    const { pid, all, nodeChildProcess } = fixture.owned.child
    const child = Object.assign(fixture.owned.child.then(() => {
      throw failure
    }), { pid, all, nodeChildProcess })
    execaMock.mockImplementationOnce(() => child)
    const disconnect = vi.fn()
    Object.assign(nodeChildProcess, { connected: true, disconnect })
    const dev = startDevProcess('node', ['fixture.js'])
    const stopping = dev.stop(100, { gracefulTimeoutMs: 100 })
    const result = await settleCleanup(stopping)
    expect(result).toMatchObject({ status: 'rejected', reason: expect.any(DevProcessGracefulShutdownError) })
    expect(result.status === 'rejected' && result.reason.cause).toBe(failure)
    expect(dev.stop(100)).toBe(stopping)
    await expect(dev.stop(100)).rejects.toBe(result.status === 'rejected' ? result.reason : undefined)
    expect(disconnect).toHaveBeenCalledOnce()
    expect(fixture.signals).toContainEqual({ pid, signal: 'SIGTERM' })
    expect([...fixture.processes.keys()]).toEqual([71, 72])
  })

  it.each([undefined, '1'])('batches Windows identity checks and terminates only the registered PID list once with cleanup tracing %s', async (trace) => {
    vi.stubEnv('WEAPP_VITE_E2E_CLEANUP_TRACE', trace)
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    const output = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    const fixture = mockProcessTree()
    const dev = startDevProcess('node', ['fixture.js'])
    await Promise.all([dev.stop(0), cleanupTrackedDevProcesses(0), dev.stop(0)])
    expect(execaMock.mock.calls.filter(([command]) => command === 'taskkill')).toEqual([
      ['taskkill', ['/PID', '62', '/PID', '61', '/F'], expect.objectContaining({ reject: false })],
    ])
    expect(execaMock.mock.calls.some(([command]) => command === 'ps')).toBe(false)
    expect([...fixture.processes.keys()]).toEqual([71, 72])
    if (trace) {
      expect(output.mock.calls.some(([line]) => String(line).includes('"stage":"dev-kernel-snapshot","event":"begin"'))).toBe(true)
      expect(output.mock.calls.some(([line]) => String(line).includes('"stage":"dev-taskkill","event":"end"'))).toBe(true)
    }
    else {
      expect(output).not.toHaveBeenCalled()
    }
  })

  it('waits for an IPC child to clean up on Windows before considering force kill', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    const fixture = mockProcessTree()
    const disconnect = vi.fn(() => fixture.finish())
    Object.assign(fixture.owned.child.nodeChildProcess, { connected: true, disconnect })
    const dev = startDevProcess('node', ['fixture.js'])
    expect(execaMock).toHaveBeenCalledWith('node', ['fixture.js'], expect.objectContaining({ ipc: true }))
    await Promise.all([dev.stop(100), dev.stop(100)])
    expect(disconnect).toHaveBeenCalledOnce()
    expect(execaMock.mock.calls.some(([command]) => command === 'taskkill')).toBe(false)
    expect(fixture.signals).toEqual([])
    expect([...fixture.processes.keys()]).toEqual([71, 72])
  })

  it('uses an explicit native shutdown request on Windows and waits for real exit after its receipt', async () => {
    vi.useFakeTimers()
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    const fixture = mockProcessTree()
    const request = vi.fn(async () => undefined)
    const dispose = vi.fn(async () => undefined)
    const dev = startDevProcess('node', ['native-vite-cli.js'], { ipc: false, gracefulShutdown: request, disposeShutdown: dispose })
    let stopped = false
    const stopping = dev.stop(100, { gracefulTimeoutMs: 1_000 })
    void stopping.then(() => stopped = true)
    await vi.advanceTimersByTimeAsync(0)
    expect(request).toHaveBeenCalledOnce()
    expect(stopped).toBe(false)
    expect(dispose).not.toHaveBeenCalled()
    expect(fixture.signals).toEqual([])
    fixture.finish()
    await vi.runAllTimersAsync()
    await stopping
    expect(dispose).toHaveBeenCalledOnce()
    expect(dev.stop(100)).toBe(stopping)
    expect(execaMock).toHaveBeenCalledWith('node', ['native-vite-cli.js'], expect.objectContaining({ ipc: false }))
  })

  it('retains an explicit host-control failure while cleaning only registered processes', async () => {
    vi.useFakeTimers()
    const fixture = mockProcessTree()
    fixture.ignoreTermPids.clear()
    const failure = new Error('native host cleanup receipt failed')
    const request = vi.fn(async () => {
      throw failure
    })
    const dispose = vi.fn(async () => undefined)
    const dev = startDevProcess('node', ['native-vite-cli.js'], { gracefulShutdown: request, disposeShutdown: dispose })
    const stopping = dev.stop(100)
    const result = await settleCleanup(stopping)
    expect(result).toMatchObject({
      status: 'rejected',
      reason: { name: 'DevProcessGracefulShutdownError', cause: failure, evidence: { requestError: failure } },
    })
    expect(request).toHaveBeenCalledOnce()
    expect(dispose).toHaveBeenCalledOnce()
    expect([...fixture.processes.keys()]).toEqual([71, 72])
    expect(dev.stop(100)).toBe(stopping)
    expect(execaMock).toHaveBeenCalledWith('node', ['native-vite-cli.js'], expect.objectContaining({ ipc: false }))
  })

  it('fails an acknowledged native shutdown that still needs forced termination', async () => {
    vi.useFakeTimers()
    const fixture = mockProcessTree()
    const request = vi.fn(async () => undefined)
    const dev = startDevProcess('node', ['native-vite-cli.js'], { gracefulShutdown: request })
    const result = await settleCleanup(dev.stop(100, { gracefulTimeoutMs: 100 }))
    expect(result).toMatchObject({
      status: 'rejected',
      reason: { name: 'DevProcessGracefulShutdownError', evidence: { gracefulTimeoutMs: 100 } },
    })
    expect(request).toHaveBeenCalledOnce()
    expect([...fixture.processes.keys()]).toEqual([71, 72])
  })

  it('keeps control disposal registered for retry without repeating native shutdown', async () => {
    vi.useFakeTimers()
    const fixture = mockProcessTree()
    const request = vi.fn(async () => fixture.finish())
    const failure = new Error('native control temporary config still in use')
    const dispose = vi.fn(async () => undefined).mockRejectedValueOnce(failure)
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true)
    const dev = startDevProcess('node', ['native-vite-cli.js'], { gracefulShutdown: request, disposeShutdown: dispose })
    const stopping = dev.stop(0)
    expect(dev.stop(0)).toBe(stopping)
    expect(await settleCleanup(stopping)).toEqual({ status: 'rejected', reason: failure })
    expect(await settleCleanup(cleanupTrackedDevProcesses(0))).toEqual({ status: 'fulfilled', value: undefined })
    expect(dispose).toHaveBeenCalledTimes(2)
    expect(request).toHaveBeenCalledOnce()
    expect(kill).not.toHaveBeenCalled()
    await dev.stop(0)
    expect(dispose).toHaveBeenCalledTimes(2)
  })

  it('preserves native shutdown failure while retrying failed control disposal', async () => {
    vi.useFakeTimers()
    const fixture = mockProcessTree()
    fixture.ignoreTermPids.clear()
    const original = new Error('native host cleanup failed')
    const disposal = new Error('native control directory removal failed')
    const request = vi.fn(async () => {
      throw original
    })
    const dispose = vi.fn(async () => undefined).mockRejectedValueOnce(disposal)
    const dev = startDevProcess('node', ['native-vite-cli.js'], { gracefulShutdown: request, disposeShutdown: dispose })
    const first = await settleCleanup(dev.stop(100))
    expect(first).toMatchObject({
      status: 'rejected',
      reason: { errors: [expect.objectContaining({ cause: original }), disposal] },
    })
    const signals = [...fixture.signals]
    await expect(cleanupTrackedDevProcesses(100)).rejects.toMatchObject({ cause: original })
    expect(dispose).toHaveBeenCalledTimes(2)
    expect(request).toHaveBeenCalledOnce()
    expect(fixture.signals).toEqual(signals)
    await expect(cleanupTrackedDevProcesses(100)).resolves.toBeUndefined()
  })

  it('lets an explicit controller confirm a fully drained native exit', async () => {
    const owned = createChild()
    execaMock.mockReturnValue(owned.child)
    const request = vi.fn((settledExit: Promise<unknown>) => settledExit)
    const dispose = vi.fn(async () => undefined)
    const dev = startDevProcess('node', ['native-vite-cli.js'], { gracefulShutdown: request, disposeShutdown: dispose })
    owned.exit()
    await dev.stop(0)
    expect(request).toHaveBeenCalledOnce()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it.each([0, 1])('retains a deferred control failure after a fully drained native exit=%s', async (exitCode) => {
    vi.useFakeTimers()
    const owned = createChild()
    const drained = Promise.withResolvers<{ exitCode: number, signal: undefined }>()
    const child = Object.assign(drained.promise, { pid: owned.child.pid, all: owned.child.all, nodeChildProcess: owned.child.nodeChildProcess })
    execaMock.mockReturnValue(child)
    const receipt = Promise.withResolvers<void>()
    const request = vi.fn((settledExit: Promise<unknown>) => {
      expect(settledExit).toBeInstanceOf(Promise)
      return receipt.promise
    })
    const dispose = vi.fn(async () => undefined)
    const failure = new Error('native host cleanup receipt failed after process exit')
    const dev = startDevProcess('node', ['native-vite-cli.js'], { gracefulShutdown: request, disposeShutdown: dispose })
    owned.exitNative()
    if (exitCode === 0) {
      drained.resolve({ exitCode, signal: undefined })
    }
    else {
      drained.reject(Object.assign(new Error('native process failed'), { exitCode, stderr: 'native process failed' }))
    }
    const result = Promise.allSettled([dev.stop(0, { gracefulTimeoutMs: 1_000 })])
    await vi.advanceTimersByTimeAsync(0)
    expect(request).toHaveBeenCalledOnce()
    expect(dispose, 'a raw drained exit must not bypass the authoritative control result').not.toHaveBeenCalled()
    receipt.reject(failure)
    await vi.runAllTimersAsync()
    expect((await result)[0]).toMatchObject({
      status: 'rejected',
      reason: { name: 'DevProcessGracefulShutdownError', cause: failure, evidence: { requestError: failure } },
    })
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('reports incomplete Windows IPC cleanup after force killing only its held child', async () => {
    vi.useFakeTimers()
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    const fixture = mockProcessTree()
    const disconnect = vi.fn()
    Object.assign(fixture.owned.child.nodeChildProcess, { connected: true, disconnect })
    const dev = startDevProcess('node', ['fixture.js'], { ipc: true })
    const stopping = dev.stop(100, { gracefulTimeoutMs: 100 })
    const result = Promise.allSettled([stopping])
    await vi.advanceTimersByTimeAsync(0)
    expect(disconnect).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(100)
    await vi.runAllTimersAsync()
    const [stopped] = await result
    expect(stopped).toMatchObject({ status: 'rejected', reason: expect.any(DevProcessGracefulShutdownError) })
    expect(dev.stop(100)).toBe(stopping)
    await expect(dev.stop(100)).rejects.toBe(stopped?.status === 'rejected' ? stopped.reason : undefined)
    expect(execaMock.mock.calls.filter(([command]) => command === 'taskkill')).toEqual([
      ['taskkill', ['/PID', '62', '/PID', '61', '/F'], expect.objectContaining({ reject: false })],
    ])
    expect([...fixture.processes.keys()]).toEqual([71, 72])
  })

  it('keeps Windows inspection and an active build outside the force observation budget', async () => {
    vi.useFakeTimers()
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    const fixture = mockProcessTree()
    kernelQueryMock.mockImplementationOnce(async () => {
      await new Promise(resolve => setTimeout(resolve, 30_000))
      return fixture.queryWindows()
    })
    const disconnect = vi.fn(() => setTimeout(() => fixture.finish(), 6_000))
    Object.assign(fixture.owned.child.nodeChildProcess, { connected: true, disconnect })
    const dev = startDevProcess('node', ['fixture.js'])
    const stopping = dev.stop(5_000)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(disconnect).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(fixture.processes.has(61)).toBe(true)
    expect(execaMock.mock.calls.some(([command]) => command === 'taskkill')).toBe(false)
    await vi.advanceTimersByTimeAsync(1_000)
    await stopping
    expect(execaMock.mock.calls.some(([command]) => command === 'taskkill')).toBe(false)
    expect([...fixture.processes.keys()]).toEqual([71, 72])
  })

  it.each(['darwin', 'win32'] as const)('retains cancellation while draining only owned processes on %s', async (platform) => {
    vi.useFakeTimers()
    vi.spyOn(process, 'platform', 'get').mockReturnValue(platform)
    const fixture = mockProcessTree()
    const disconnect = vi.fn()
    Object.assign(fixture.owned.child.nodeChildProcess, { connected: true, disconnect })
    const cancelled = new Error('fixture shutdown cancelled')
    const controller = new AbortController()
    const dev = startDevProcess('node', ['fixture.js'])
    const stopping = dev.stop(100, { signal: controller.signal })
    const result = Promise.allSettled([stopping])
    await vi.advanceTimersByTimeAsync(0)
    expect(disconnect).toHaveBeenCalledOnce()
    controller.abort(cancelled)
    await vi.runAllTimersAsync()
    const [stopped] = await result
    expect(stopped).toMatchObject({
      status: 'rejected',
      reason: { name: 'DevProcessGracefulShutdownError', cause: cancelled, evidence: { cancelled: { reason: cancelled } } },
    })
    expect([...fixture.processes.keys()]).toEqual([71, 72])
    expect(dev.stop(100)).toBe(stopping)
    await expect(dev.stop(100)).rejects.toBe(stopped?.status === 'rejected' ? stopped.reason : undefined)
  })

  it.each(['cancelled', 'timeout'] as const)('retains %s shutdown evidence when the Windows root exits during identity inspection', async (outcome) => {
    vi.useFakeTimers()
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    const fixture = mockProcessTree()
    const disconnect = vi.fn()
    Object.assign(fixture.owned.child.nodeChildProcess, { connected: true, disconnect })
    const cancelled = new Error('fixture shutdown cancelled during identity inspection')
    const controller = new AbortController()
    const dev = startDevProcess('node', ['fixture.js'])
    const stopping = dev.stop(100, { gracefulTimeoutMs: 100, signal: controller.signal })
    const result = Promise.allSettled([stopping])
    await vi.advanceTimersByTimeAsync(0)
    expect(disconnect).toHaveBeenCalledOnce()
    const identityQuery = Promise.withResolvers<void>()
    const inspectionStarted = vi.fn()
    kernelQueryMock.mockImplementationOnce(async (pids?: readonly number[]) => {
      inspectionStarted(pids)
      await identityQuery.promise
      return fixture.queryWindows(pids)
    })
    if (outcome === 'cancelled') {
      controller.abort(cancelled)
    }
    await vi.advanceTimersByTimeAsync(outcome === 'timeout' ? 100 : 0)
    fixture.finish()
    identityQuery.resolve()
    await vi.runAllTimersAsync()
    const [stopped] = await result
    const failure: unknown = stopped?.status === 'rejected' ? stopped.reason : undefined
    expect(inspectionStarted).toHaveBeenCalledOnce()
    expect(inspectionStarted).toHaveBeenCalledWith(expect.arrayContaining([61]))
    expect(failure).toBeInstanceOf(DevProcessGracefulShutdownError)
    if (failure instanceof DevProcessGracefulShutdownError) {
      expect(failure.evidence).toEqual({ gracefulTimeoutMs: 100, ...(outcome === 'cancelled' ? { cancelled: { reason: cancelled } } : {}) })
      expect(failure.cause).toBe(outcome === 'cancelled' ? cancelled : undefined)
    }
    expect(fixture.signals).toEqual([])
    expect(execaMock.mock.calls.some(([command]) => command === 'taskkill')).toBe(false)
    expect([...fixture.processes.keys()]).toEqual([71, 72])
  })

  it('preserves Windows processes when batched identity inspection fails and retries safely', async () => {
    vi.useFakeTimers()
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    const fixture = mockProcessTree()
    fixture.unknownIdentityPids.add(62)
    const dev = startDevProcess('node', ['fixture.js'])
    expect(await settleCleanup(dev.stop(100))).toMatchObject({ status: 'rejected', reason: expect.any(Error) })
    expect(fixture.signals).toEqual([])
    fixture.unknownIdentityPids.clear()
    expect(await settleCleanup(cleanupTrackedDevProcesses(100))).toEqual({ status: 'fulfilled', value: undefined })
    expect([...fixture.processes.keys()]).toEqual([71, 72])
  })
})
