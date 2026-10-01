import type { ChildProcess } from 'node:child_process'
import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { terminateOwnedCliProcess } from './automatorCliProcess'

const { execaMock } = vi.hoisted(() => ({ execaMock: vi.fn() }))
vi.mock('execa', () => ({ execa: execaMock }))

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  execaMock.mockReset()
})

describe('owned CLI disposal', () => {
  it.each(['darwin', 'win32'] as const)('does not signal an exited child on %s', async (platform) => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue(platform)
    const signal = vi.spyOn(process, 'kill').mockImplementation(() => true)
    for (const state of [{ exitCode: 0, signalCode: null }, { exitCode: null, signalCode: 'SIGTERM' }]) {
      const child = { pid: 12345, ...state } as ChildProcess
      await terminateOwnedCliProcess(child)
      await terminateOwnedCliProcess(child)
    }
    expect(signal).not.toHaveBeenCalled()
    expect(execaMock).not.toHaveBeenCalled()
  })

  it('does not probe or escalate a child that exits after TERM', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
    const child = { pid: 12345, exitCode: null, signalCode: null } as ChildProcess
    const signal = vi.spyOn(process, 'kill').mockImplementation(() => {
      child.signalCode = 'SIGTERM'
      return true
    })
    await Promise.all([terminateOwnedCliProcess(child), terminateOwnedCliProcess(child)])
    expect(signal.mock.calls).toEqual([[-12345, 'SIGTERM']])
  })

  it('rechecks the child before escalating a live owned group', async () => {
    vi.useFakeTimers()
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
    const child = { pid: 12345, exitCode: null, signalCode: null } as ChildProcess
    const signal = vi.spyOn(process, 'kill').mockImplementation((_pid, value) => {
      if (value === 'SIGKILL') {
        child.signalCode = 'SIGKILL'
      }
      return true
    })
    const disposal = terminateOwnedCliProcess(child)
    await vi.runAllTimersAsync()
    await disposal
    expect(signal.mock.calls).toEqual([[-12345, 'SIGTERM'], [-12345, 'SIGKILL']])
  })
})
