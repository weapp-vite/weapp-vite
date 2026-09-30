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
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it.each(['darwin', 'win32'] as const)('preserves unowned DevTools and session artifacts on %s', async (platform) => {
    const { cleanupResidualDevtoolsProcesses } = await import('./ide-devtools-cleanup')
    const task = cleanupResidualDevtoolsProcesses(platform)
    await vi.runAllTimersAsync()
    await task
    expect(execaMock).not.toHaveBeenCalled()
    expect(cleanupProcessesByCommandPatternsMock).not.toHaveBeenCalled()
    expect(fsRmMock).not.toHaveBeenCalled()
  })

  it('cleans devtools compile cache via wechat cli', async () => {
    const { cleanDevtoolsCache } = await import('./ide-devtools-cleanup')

    await cleanDevtoolsCache('compile', { platform: 'darwin' })

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

  it('uses the selected CLI consistently for cache retry', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH', 'stable-cli')
    execaMock.mockResolvedValueOnce({ exitCode: 1, stderr: 'wait IDE port timeout' })
    const { cleanDevtoolsCache } = await import('./ide-devtools-cleanup')
    const task = cleanDevtoolsCache('compile')
    await vi.runAllTimersAsync()
    await task
    expect(execaMock.mock.calls.map(call => call[0])).toEqual(['stable-cli', 'stable-cli'])
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

    const task = cleanDevtoolsCache('compile', { platform: 'darwin' })
    await vi.runAllTimersAsync()
    await task

    expect(cleanupProcessesByCommandPatternsMock).not.toHaveBeenCalled()
    expect(execaMock).toHaveBeenCalledTimes(2)
  })

  it('preserves a preexisting DevTools after cache cleanup', async () => {
    const { cleanDevtoolsCacheAndStop } = await import('./ide-devtools-cleanup')

    const task = cleanDevtoolsCacheAndStop('compile', { platform: 'darwin' })
    await vi.runAllTimersAsync()
    await task

    expect(execaMock).toHaveBeenCalledTimes(1)
    expect(cleanupProcessesByCommandPatternsMock).not.toHaveBeenCalled()
  })

  it('runs full ide cleanup by chaining dev cleanup and devtools cleanup', async () => {
    const { cleanupResidualIdeProcesses } = await import('./ide-devtools-cleanup')

    const task = cleanupResidualIdeProcesses('darwin')
    await vi.runAllTimersAsync()
    await task

    expect(cleanupResidualDevProcessesMock).toHaveBeenCalledTimes(1)
    expect(cleanupProcessesByCommandPatternsMock).not.toHaveBeenCalled()
    expect(fsRmMock).not.toHaveBeenCalled()
  })

  it.each(['all', 'auth', 'session', 'storage', 'file', 'network'])('rejects automatic %s cache cleanup before invoking DevTools', async (cleanType) => {
    const { cleanDevtoolsCache, cleanDevtoolsCacheAndStop } = await import('./ide-devtools-cleanup')

    for (const clean of [cleanDevtoolsCache, cleanDevtoolsCacheAndStop]) {
      await expect(clean(cleanType as 'compile', { platform: 'darwin' })).rejects.toThrow('only compile cache')
    }

    expect(execaMock).not.toHaveBeenCalled()
    expect(cleanupProcessesByCommandPatternsMock).not.toHaveBeenCalled()
    expect(fsRmMock).not.toHaveBeenCalled()
  })
})
