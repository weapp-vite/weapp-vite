import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const cleanupProcessesByCommandPatternsMock = vi.hoisted(() => vi.fn())
const cleanupResidualDevProcessesMock = vi.hoisted(() => vi.fn())
const execaMock = vi.hoisted(() => vi.fn())
const fsRmMock = vi.hoisted(() => vi.fn())

vi.mock('./dev-process', () => ({
  cleanupProcessesByCommandPatterns: cleanupProcessesByCommandPatternsMock,
}))

vi.mock('./dev-process-cleanup', () => ({
  cleanupResidualDevProcesses: cleanupResidualDevProcessesMock,
}))

vi.mock('execa', () => ({
  execa: execaMock,
}))

vi.mock('node:fs/promises', () => ({
  rm: fsRmMock,
}))

describe('ide devtools cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    cleanupProcessesByCommandPatternsMock.mockReset()
    cleanupProcessesByCommandPatternsMock.mockResolvedValue(undefined)
    cleanupResidualDevProcessesMock.mockReset()
    cleanupResidualDevProcessesMock.mockResolvedValue(undefined)
    execaMock.mockReset()
    execaMock.mockResolvedValue({ exitCode: 0, stderr: '', stdout: '' })
    fsRmMock.mockReset()
    fsRmMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns unix devtools process patterns for macOS cleanup', async () => {
    const { resolveIdeDevtoolsProcessPatterns } = await import('./ide-devtools-cleanup')

    expect(resolveIdeDevtoolsProcessPatterns('darwin')).toEqual([
      'e2e/utils/automator.cli-bridge.ts',
      'wechatwebdevtools.app/Contents/MacOS/cli',
      'wechatwebdevtools.app/Contents/MacOS/wechatwebdevtools',
      'wechatwebdevtools',
    ])
  })

  it('kills residual wechatdevtools processes on Windows and clears automator sessions', async () => {
    const { cleanupResidualDevtoolsProcesses } = await import('./ide-devtools-cleanup')

    const task = cleanupResidualDevtoolsProcesses('win32')
    await vi.runAllTimersAsync()
    await task

    expect(cleanupResidualDevProcessesMock).not.toHaveBeenCalled()
    expect(execaMock).toHaveBeenCalledWith('taskkill', ['/F', '/IM', 'wechatdevtools.exe', '/T'], expect.objectContaining({
      reject: false,
    }))
    expect(cleanupProcessesByCommandPatternsMock).not.toHaveBeenCalled()
    expect(fsRmMock).toHaveBeenCalledTimes(1)
  })

  it('kills residual unix devtools processes by command pattern', async () => {
    const { cleanupResidualDevtoolsProcesses } = await import('./ide-devtools-cleanup')

    const task = cleanupResidualDevtoolsProcesses('darwin')
    await vi.runAllTimersAsync()
    await task

    expect(cleanupResidualDevProcessesMock).not.toHaveBeenCalled()
    expect(cleanupProcessesByCommandPatternsMock).toHaveBeenCalledWith([
      'e2e/utils/automator.cli-bridge.ts',
      'wechatwebdevtools.app/Contents/MacOS/cli',
      'wechatwebdevtools.app/Contents/MacOS/wechatwebdevtools',
      'wechatwebdevtools',
    ], 2_500)
    expect(execaMock).not.toHaveBeenCalled()
    expect(fsRmMock).toHaveBeenCalledTimes(1)
  })

  it('cleans devtools compile cache via wechat cli', async () => {
    const { cleanDevtoolsCache } = await import('./ide-devtools-cleanup')

    await cleanDevtoolsCache('compile')

    expect(execaMock).toHaveBeenCalledWith(
      '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      ['cache', '--clean', 'compile'],
      expect.objectContaining({
        reject: false,
        stdin: 'ignore',
        timeout: 20_000,
      }),
    )
  })

  it('retries cache clean after stale DevTools port initialization failure', async () => {
    execaMock
      .mockResolvedValueOnce({
        exitCode: 1,
        stderr: '#initialize-error: wait IDE port timeout\nIDE may already started at port 20130, trying to connect',
        stdout: '',
      })
      .mockResolvedValueOnce({ exitCode: 0, stderr: '', stdout: '' })

    const { cleanDevtoolsCache } = await import('./ide-devtools-cleanup')

    const task = cleanDevtoolsCache('all')
    await vi.runAllTimersAsync()
    await task

    expect(cleanupProcessesByCommandPatternsMock).toHaveBeenCalledWith([
      'e2e/utils/automator.cli-bridge.ts',
      'wechatwebdevtools.app/Contents/MacOS/cli',
      'wechatwebdevtools.app/Contents/MacOS/wechatwebdevtools',
      'wechatwebdevtools',
    ], 2_500)
    expect(execaMock).toHaveBeenCalledTimes(2)
  })

  it('runs full ide cleanup by chaining dev cleanup and devtools cleanup', async () => {
    const { cleanupResidualIdeProcesses } = await import('./ide-devtools-cleanup')

    const task = cleanupResidualIdeProcesses('darwin')
    await vi.runAllTimersAsync()
    await task

    expect(cleanupResidualDevProcessesMock).toHaveBeenCalledTimes(1)
    expect(cleanupProcessesByCommandPatternsMock).toHaveBeenCalledTimes(1)
    expect(fsRmMock).toHaveBeenCalledTimes(1)
  })
})
