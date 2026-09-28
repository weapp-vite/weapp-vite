import { beforeEach, describe, expect, it, vi } from 'vitest'
import { terminateUploadProcess } from './processTree'

const state = vi.hoisted(() => ({ platform: 'linux', execFileSync: vi.fn(), kill: vi.fn() }))
vi.mock('node:child_process', () => ({ execFileSync: state.execFileSync }))
vi.mock('node:process', () => ({
  default: {
    get platform() { return state.platform },
    kill: state.kill,
  },
}))

const missingProcess = Object.assign(new Error('process missing'), { code: 'ESRCH' })

beforeEach(() => {
  state.platform = 'linux'
  state.execFileSync.mockReset()
  state.kill.mockReset()
})

describe('upload process ownership', () => {
  it('never signals a positive PID after the owned POSIX worker has exited', () => {
    state.kill.mockImplementation(() => {
      throw missingProcess
    })
    terminateUploadProcess(101, { processGroup: true, exited: true })
    expect(state.kill.mock.calls).toEqual([[-101, 'SIGKILL']])
  })

  it('retains direct termination for a live child before its process group exists', () => {
    state.kill.mockImplementation((pid: number) => {
      if (pid < 0) {
        throw missingProcess
      }
      return true
    })
    terminateUploadProcess(101, { processGroup: true })
    expect(state.kill.mock.calls).toEqual([[-101, 'SIGKILL'], [101, 'SIGKILL']])
  })

  it('recovers Windows descendants without signaling an already exited root PID', () => {
    state.platform = 'win32'
    state.execFileSync.mockImplementation((command: string) => command === 'powershell.exe' ? '202\r\n' : '')
    terminateUploadProcess(101, { processGroup: true, exited: true, lifetime: { start: 1000, end: 2000 } })
    expect(state.execFileSync.mock.calls.filter(([command]) => command === 'taskkill'))
      .toEqual([['taskkill', ['/PID', '202', '/T', '/F'], expect.objectContaining({ windowsHide: true, timeout: 5000 })]])
    expect(state.kill).not.toHaveBeenCalled()
  })

  it('recovers the surviving Windows subtree when the root disappears during cancellation', () => {
    state.platform = 'win32'
    state.kill.mockImplementation(() => {
      throw missingProcess
    })
    state.execFileSync.mockImplementation((command: string, args: string[]) => {
      if (command === 'powershell.exe') {
        return '202\r\n'
      }
      if (args[1] === '101') {
        throw new Error('root disappeared before taskkill')
      }
      return ''
    })
    terminateUploadProcess(101, { processGroup: true, lifetime: { start: 1000, end: 2000 } })
    expect(state.execFileSync.mock.calls.filter(([command]) => command === 'taskkill').map(([, args]) => args))
      .toEqual([['/PID', '101', '/T', '/F'], ['/PID', '202', '/T', '/F']])
  })

  it('refuses Windows recovery without an owned lifetime instead of guessing from a reused PID', () => {
    state.platform = 'win32'
    expect(() => terminateUploadProcess(101, { exited: true })).toThrow(Error)
    expect(state.execFileSync).not.toHaveBeenCalled()
    expect(state.kill).not.toHaveBeenCalled()
  })

  it('does not silently accept a live Windows process when taskkill is denied', () => {
    state.platform = 'win32'
    const denied = new Error('access denied')
    state.execFileSync.mockImplementation(() => {
      throw denied
    })
    state.kill.mockReturnValue(true)
    expect(() => terminateUploadProcess(101)).toThrow(denied)
  })
})
