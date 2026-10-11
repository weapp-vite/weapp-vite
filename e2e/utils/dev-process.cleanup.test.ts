import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupTrackedDevProcesses, startDevProcess } from './dev-process'
import { cleanupResidualDevProcesses } from './dev-process-cleanup'
import { createChild, createProcessTreeFixture } from './devProcessCleanupFixture'

const execaMock = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: execaMock }))
vi.mock('./devProcessDiagnostics', () => ({ createDevProcessDiagnostics: () => ({ write() {}, flush() {} }) }))

const fixtures = new Set<ReturnType<typeof createProcessTreeFixture>>()

function mockProcessTree() {
  const fixture = createProcessTreeFixture(execaMock)
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
      [field]: field === 'started' ? 'Mon Oct 5 12:30:05 2026' : path.resolve('replacement-node'),
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
    expect(execaMock.mock.calls.filter(([command]) => command === 'powershell.exe')).toHaveLength(2)
    expect([...fixture.processes.keys()]).toEqual([71, 72])
    if (trace) {
      expect(output.mock.calls.some(([line]) => String(line).includes('"stage":"dev-cim-snapshot","event":"begin"'))).toBe(true)
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
    const dev = startDevProcess('node', ['fixture.js'], { ipc: true })
    await Promise.all([dev.stop(100), dev.stop(100)])
    expect(disconnect).toHaveBeenCalledOnce()
    expect(execaMock.mock.calls.some(([command]) => command === 'taskkill')).toBe(false)
    expect(fixture.signals).toEqual([])
    expect([...fixture.processes.keys()]).toEqual([71, 72])
  })

  it('force kills only its held Windows child when IPC cleanup does not finish', async () => {
    vi.useFakeTimers()
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    const fixture = mockProcessTree()
    const disconnect = vi.fn()
    Object.assign(fixture.owned.child.nodeChildProcess, { connected: true, disconnect })
    const dev = startDevProcess('node', ['fixture.js'], { ipc: true })
    const stopping = dev.stop(100)
    await vi.advanceTimersByTimeAsync(0)
    expect(disconnect).toHaveBeenCalledOnce()
    expect(execaMock.mock.calls.filter(([command]) => command === 'powershell.exe')).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(100)
    await vi.runAllTimersAsync()
    await stopping
    expect(execaMock.mock.calls.filter(([command]) => command === 'taskkill')).toEqual([
      ['taskkill', ['/PID', '62', '/PID', '61', '/F'], expect.objectContaining({ reject: false })],
    ])
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
    expect(execaMock.mock.calls.filter(([command]) => command === 'powershell.exe')).toHaveLength(1)
    fixture.unknownIdentityPids.clear()
    expect(await settleCleanup(cleanupTrackedDevProcesses(100))).toEqual({ status: 'fulfilled', value: undefined })
    expect([...fixture.processes.keys()]).toEqual([71, 72])
  })
})
