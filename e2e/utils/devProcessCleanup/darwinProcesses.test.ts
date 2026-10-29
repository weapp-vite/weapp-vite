import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sameManagedProcess } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/processIdentity'
import { createProcessTreeFixture } from '../devProcessCleanupFixture'
import { createDevProcessCleanup } from './index'
import { captureDevProcessTree, readDevProcessIdentities } from './processes'

const execute = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: execute }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
})
afterEach(() => vi.restoreAllMocks())

describe('macOS dev process kernel ownership', () => {
  it('captures mutable process titles using one exact kernel query for the reachable tree', async () => {
    const fixture = createProcessTreeFixture(execute)
    const root = { ...fixture.processes.get(61)! }
    const child = { ...fixture.processes.get(62)! }
    fixture.afterDiscovery = () => {
      fixture.processes.get(61)!.title = 'npm'
      fixture.processes.get(62)!.title = 'npm child'
    }
    expect(await captureDevProcessTree(61, () => true)).toEqual([
      { pid: 62, executable: child.executable, started: child.started },
      { pid: 61, executable: root.executable, started: root.started },
    ])
    expect(execute.mock.calls[0]![1]).toEqual(['-Ao', 'pid=,ppid=,lstart='])
    const kernelCalls = execute.mock.calls.filter(([command]) => command === '/usr/bin/osascript')
    expect(kernelCalls).toHaveLength(1)
    expect(JSON.parse(kernelCalls[0]![1].at(-1))).toEqual([62, 61])
    expect(fixture.signals).toEqual([])
  })

  it('rechecks a batch once and rejects real executable drift with the original strict comparison', async () => {
    const fixture = createProcessTreeFixture(execute)
    const first = await readDevProcessIdentities([61, 62])
    fixture.processes.get(61)!.executable += '-replaced'
    const second = await readDevProcessIdentities([61, 62])
    expect(sameManagedProcess(first.get(61)!, second.get(61)!)).toBe(false)
    expect(sameManagedProcess(first.get(62)!, second.get(62)!)).toBe(true)
    expect(execute.mock.calls.filter(([command]) => command === '/usr/bin/osascript')).toHaveLength(2)
  })

  it('rejects a reused PID between the tree snapshot and the birth-time recheck', async () => {
    const fixture = createProcessTreeFixture(execute)
    fixture.afterDiscovery = () => {
      fixture.processes.get(62)!.started = 'Mon Oct 5 12:30:09 2026'
    }
    await expect(captureDevProcessTree(61, () => true)).rejects.toMatchObject({ pids: [62], cause: expect.any(Error) })
    expect(fixture.signals).toEqual([])
  })

  it.each(['permission', 'timeout', 'live-null'])('keeps %s kernel inspection unconfirmed and signals no process', async (failure) => {
    const fixture = createProcessTreeFixture(execute)
    const provider = execute.getMockImplementation()!
    const response = failure === 'live-null'
      ? { exitCode: 0, stdout: JSON.stringify([{ pid: 61, executable: fixture.processes.get(61)!.executable }, { pid: 62, executable: null }]), stderr: '' }
      : failure === 'timeout'
        ? { exitCode: undefined, stdout: '', stderr: '', timedOut: true, signal: 'SIGTERM' }
        : { exitCode: 1, stdout: '', stderr: 'Permission denied' }
    execute.mockImplementation((command: string, args: string[]) => command === '/usr/bin/osascript'
      ? Promise.resolve(response)
      : provider(command, args))
    const disconnect = vi.fn(() => false)
    const cleanup = createDevProcessCleanup({ pid: 61, isRootHeld: () => true, disconnectRoot: disconnect, settledExit: Promise.resolve() })
    await expect(cleanup(0)).rejects.toMatchObject({ pids: [62], cause: expect.any(Error) })
    expect(fixture.signals).toEqual([])
    expect(disconnect).not.toHaveBeenCalled()
  })

  it('revokes a terminal descendant after TERM without signalling its PID again', async () => {
    const fixture = createProcessTreeFixture(execute)
    fixture.afterSignal = (pid, signal) => {
      if (pid === 62 && signal === 'SIGTERM') {
        Object.assign(fixture.processes.get(62)!, { status: 'Z', executable: '' })
      }
    }
    const cleanup = createDevProcessCleanup({
      pid: 61,
      isRootHeld: () => fixture.owned.child.nodeChildProcess.exitCode === null,
      disconnectRoot: () => false,
      settledExit: fixture.owned.child,
    })
    await cleanup(0)
    expect(fixture.signals).toEqual([{ pid: 62, signal: 'SIGTERM' }, { pid: 61, signal: 'SIGTERM' }])
    expect(fixture.processes.get(62)?.status).toBe('Z')
    await cleanup(0)
    expect(fixture.signals).toHaveLength(2)
  })

  it('retains a live descendant with an unreadable image after TERM for safe cleanup retry', async () => {
    const fixture = createProcessTreeFixture(execute)
    const executable = fixture.processes.get(62)!.executable
    fixture.afterSignal = (pid, signal) => {
      if (pid === 62 && signal === 'SIGTERM') {
        fixture.processes.get(62)!.executable = ''
      }
    }
    const cleanup = createDevProcessCleanup({
      pid: 61,
      isRootHeld: () => fixture.owned.child.nodeChildProcess.exitCode === null,
      disconnectRoot: () => false,
      settledExit: fixture.owned.child,
    })
    await expect(cleanup(0)).rejects.toThrow('kernel-path-unavailable')
    expect(fixture.signals).toEqual([{ pid: 62, signal: 'SIGTERM' }, { pid: 61, signal: 'SIGTERM' }])
    fixture.afterSignal = undefined
    fixture.processes.get(62)!.executable = executable
    fixture.ignoreTermPids.delete(62)
    await cleanup(0)
    expect(fixture.signals.at(-1)).toEqual({ pid: 62, signal: 'SIGTERM' })
    expect(fixture.processes.has(62)).toBe(false)
  })
})
