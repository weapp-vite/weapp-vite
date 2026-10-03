import { EventEmitter } from 'node:events'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupTrackedDevProcesses, startDevProcess } from './dev-process'
import { cleanupResidualDevProcesses } from './dev-process-cleanup'

const execaMock = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: execaMock }))
vi.mock('./devProcessDiagnostics', () => ({ createDevProcessDiagnostics: () => ({ write() {}, flush() {} }) }))

function createChild() {
  let exit!: () => void
  const result = new Promise<{ exitCode: number, signal: undefined }>((resolve) => {
    exit = () => resolve({ exitCode: 0, signal: undefined })
  })
  const nodeChildProcess = { exitCode: null as number | null, signalCode: null }
  return {
    child: Object.assign(result, { pid: 61, all: new EventEmitter(), nodeChildProcess }),
    exit() {
      nodeChildProcess.exitCode = 0
      exit()
    },
  }
}

describe('dev process cleanup ownership', () => {
  beforeEach(() => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
  })

  afterEach(async () => {
    await cleanupTrackedDevProcesses(0)
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('releases registered children once while preserving identical unowned commands', async () => {
    vi.useFakeTimers()
    const owned = createChild()
    execaMock.mockImplementation(command => command === 'ps'
      ? Promise.resolve({ stdout: '61 41 pnpm run dev\n62 61 worker\n71 21 pnpm run dev\n72 71 worker' })
      : owned.child)
    const alive = new Set([61, 62, 71, 72])
    const kill = vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      if (!alive.has(pid)) {
        throw new Error('exited')
      }
      if (signal !== 0) {
        alive.delete(pid)
        if (pid === 61) {
          owned.exit()
        }
      }
      return true
    })
    const dev = startDevProcess('pnpm', ['run', 'dev'])
    const stopping = Promise.all([dev.stop(0), cleanupTrackedDevProcesses(0), dev.stop(0)])
    await vi.runAllTimersAsync()
    await stopping
    await cleanupResidualDevProcesses()
    expect(kill.mock.calls.filter(([, signal]) => signal !== 0).map(([pid]) => pid)).toEqual([62, 61])
    expect(alive).toEqual(new Set([71, 72]))
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

  it('revokes cleanup authority when the child exits during process discovery', async () => {
    const owned = createChild()
    execaMock.mockImplementation((command) => {
      if (command === 'ps') {
        owned.exit()
        return Promise.resolve({ stdout: '61 41 reused-process' })
      }
      return owned.child
    })
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true)
    const dev = startDevProcess('pnpm', ['run', 'dev'])
    await dev.stop(0)
    expect(kill.mock.calls.filter(([, signal]) => signal !== 0)).toEqual([])
  })

  it('does not inspect or kill unregistered processes', async () => {
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true)
    await cleanupResidualDevProcesses()
    expect(execaMock).not.toHaveBeenCalled()
    expect(kill).not.toHaveBeenCalled()
  })

  it('does not force kill a previous process tree after the owned root exits', async () => {
    vi.useFakeTimers()
    const owned = createChild()
    execaMock.mockImplementation(command => command === 'ps'
      ? Promise.resolve({ stdout: '61 41 pnpm run dev\n62 61 worker' })
      : owned.child)
    const kill = vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      if (pid === 61 && signal === 'SIGTERM') {
        owned.exit()
      }
      return true
    })
    const dev = startDevProcess('pnpm', ['run', 'dev'])
    const stopping = dev.stop(100)
    await vi.runAllTimersAsync()
    await stopping
    expect(kill.mock.calls.filter(([, signal]) => signal !== 0)).toEqual([
      [62, 'SIGTERM'],
      [61, 'SIGTERM'],
    ])
  })

  it('uses only the held PID on Windows and disposes it once', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    const owned = createChild()
    execaMock.mockImplementation((command) => {
      if (command === 'taskkill') {
        owned.exit()
        return Promise.resolve({ exitCode: 0 })
      }
      return owned.child
    })
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true)
    const dev = startDevProcess('pnpm', ['run', 'dev'])
    await Promise.all([dev.stop(0), cleanupTrackedDevProcesses(0), dev.stop(0)])
    expect(execaMock.mock.calls.filter(([command]) => command === 'taskkill')).toEqual([
      ['taskkill', ['/PID', '61', '/T', '/F'], expect.objectContaining({ reject: false })],
    ])
    expect(execaMock.mock.calls.some(([command]) => command === 'ps')).toBe(false)
    expect(kill.mock.calls.every(([, signal]) => signal === 0)).toBe(true)
  })

  it('waits for an IPC child to clean up on Windows before considering force kill', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    const owned = createChild()
    const disconnect = vi.fn(() => owned.exit())
    Object.assign(owned.child.nodeChildProcess, { connected: true, disconnect })
    execaMock.mockReturnValue(owned.child)
    const kill = vi.spyOn(process, 'kill')
    const dev = startDevProcess('node', ['dev.js'], { ipc: true })
    await Promise.all([dev.stop(100), dev.stop(100)])
    expect(disconnect).toHaveBeenCalledOnce()
    expect(execaMock).toHaveBeenCalledOnce()
    expect(kill).not.toHaveBeenCalled()
  })

  it('force kills only its held Windows child when IPC cleanup does not finish', async () => {
    vi.useFakeTimers()
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    const owned = createChild()
    const disconnect = vi.fn()
    Object.assign(owned.child.nodeChildProcess, { connected: true, disconnect })
    execaMock.mockImplementation((command) => {
      if (command === 'taskkill') {
        owned.exit()
        return Promise.resolve({ exitCode: 0 })
      }
      return owned.child
    })
    vi.spyOn(process, 'kill').mockReturnValue(true)
    const dev = startDevProcess('node', ['dev.js'], { ipc: true })
    const stopping = dev.stop(100)
    expect(disconnect).toHaveBeenCalledOnce()
    expect(execaMock).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(100)
    await vi.runAllTimersAsync()
    await stopping
    expect(execaMock.mock.calls.filter(([command]) => command === 'taskkill')).toEqual([
      ['taskkill', ['/PID', '61', '/T', '/F'], expect.objectContaining({ reject: false })],
    ])
  })
})
