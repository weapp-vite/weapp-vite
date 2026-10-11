/* eslint-disable e18e/ban-dependencies -- 关停回归使用实际 execa 子进程类型。 */
import type { Subprocess } from 'execa'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertOwnedCommandStopped, OwnedCommandShutdownError, waitForOwnedCommand } from './shutdown'

const mocks = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('execa', () => ({ execa: mocks.execute }))
vi.mock('node:timers/promises', () => ({
  setTimeout: (delay: number) => new Promise<void>(resolve => setTimeout(resolve, delay)),
}))

function commandFixture() {
  const completion = Promise.withResolvers<{ exitCode: number }>()
  const nodeChildProcess = { exitCode: null as number | null, signalCode: null as string | null }
  const child = Object.assign(completion.promise, { pid: 45678, nodeChildProcess, kill: vi.fn<(signal?: NodeJS.Signals) => boolean>(() => true) })
  return {
    child: child as unknown as Subprocess,
    kill: child.kill,
    exit() {
      nodeChildProcess.exitCode = 0
      completion.resolve({ exitCode: 0 })
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetAllMocks()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('owned outer command shutdown', () => {
  it('retains escalation after leader exit, then verifies its group has stopped', async () => {
    const command = commandFixture()
    const controller = new AbortController()
    let alive = true
    vi.spyOn(process, 'kill').mockImplementation(() => {
      if (!alive) {
        throw Object.assign(new Error('gone'), { code: 'ESRCH' })
      }
      return true
    })
    mocks.execute.mockResolvedValue({ stdout: `${command.child.pid} S` })
    command.kill.mockImplementation((signal) => {
      if (signal === 'SIGKILL') {
        alive = false
      }
      return true
    })
    let settled = false
    const running = waitForOwnedCommand(command.child, controller.signal, 'linux').finally(() => {
      settled = true
    })
    controller.abort()
    command.exit()
    await vi.advanceTimersByTimeAsync(9_999)
    expect(settled).toBe(false)
    expect(command.kill.mock.calls).toEqual([['SIGTERM']])
    await vi.advanceTimersByTimeAsync(1)
    await running
    expect(command.kill.mock.calls).toEqual([['SIGTERM'], ['SIGKILL']])
    expect(process.kill).toHaveBeenCalledWith(-command.child.pid!, 0)
  })

  it('finishes immediately when the group is empty instead of sleeping out the grace period', async () => {
    const command = commandFixture()
    const controller = new AbortController()
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw Object.assign(new Error('gone'), { code: 'ESRCH' })
    })
    const running = waitForOwnedCommand(command.child, controller.signal, 'linux')
    controller.abort()
    command.exit()
    expect(await running).toMatchObject({ exitCode: 0 })
    expect(vi.getTimerCount()).toBe(0)
    expect(command.kill.mock.calls).toEqual([['SIGTERM']])
  })

  it('does not treat a Windows leader that already exited as a verified empty process tree', async () => {
    const command = commandFixture()
    command.exit()
    await expect(waitForOwnedCommand(command.child, AbortSignal.abort(), 'win32')).rejects.toBeInstanceOf(OwnedCommandShutdownError)
    expect(mocks.execute).not.toHaveBeenCalled()
  })

  it('checks exact group state when a Unix existence probe is not permitted', async () => {
    const command = commandFixture()
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw Object.assign(new Error('not permitted'), { code: 'EPERM' })
    })
    mocks.execute.mockResolvedValue({ stdout: `${command.child.pid} Z` })
    const running = waitForOwnedCommand(command.child, AbortSignal.abort(), 'darwin')
    command.exit()
    await running
    expect(mocks.execute).toHaveBeenCalledWith('ps', ['-axo', 'pgid=,stat='], { stdin: 'ignore' })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('refuses journal cleanup when group members still run after forced termination', async () => {
    const command = commandFixture()
    vi.spyOn(process, 'kill').mockReturnValue(true)
    mocks.execute.mockResolvedValue({ stdout: `${command.child.pid} S` })
    const running = waitForOwnedCommand(command.child, AbortSignal.abort(), 'linux')
    const failure = expect(running).rejects.toBeInstanceOf(OwnedCommandShutdownError)
    command.exit()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(command.kill).toHaveBeenLastCalledWith('SIGKILL')
    await vi.advanceTimersByTimeAsync(2_000)
    await failure
    expect(command.kill.mock.calls).toEqual([['SIGTERM'], ['SIGKILL']])
  })

  it('waits for Windows taskkill completion as well as direct child exit', async () => {
    const command = commandFixture()
    const tree = Promise.withResolvers<{ exitCode: number }>()
    mocks.execute.mockReturnValue(tree.promise)
    let settled = false
    const running = waitForOwnedCommand(command.child, AbortSignal.abort(), 'win32').finally(() => {
      settled = true
    })
    command.exit()
    await vi.advanceTimersByTimeAsync(0)
    expect(settled).toBe(false)
    expect(mocks.execute).toHaveBeenCalledWith('taskkill', ['/PID', String(command.child.pid), '/T', '/F'], expect.any(Object))
    tree.resolve({ exitCode: 0 })
    await running
  })

  it('keeps an unconfirmed Windows tree termination as a blocking error', async () => {
    const command = commandFixture()
    mocks.execute.mockResolvedValue({ exitCode: 128 })
    const running = waitForOwnedCommand(command.child, AbortSignal.abort(), 'win32')
    command.exit()
    await expect(running).rejects.toBeInstanceOf(OwnedCommandShutdownError)
  })

  it('preserves failed Unix process inspection as an unconfirmed shutdown', async () => {
    const command = commandFixture()
    command.exit()
    vi.spyOn(process, 'kill').mockReturnValue(true)
    mocks.execute.mockRejectedValue(new Error('process inspection unavailable'))
    await expect(assertOwnedCommandStopped(command.child, 'linux')).rejects.toBeInstanceOf(OwnedCommandShutdownError)
  })
})
