import { beforeEach, describe, expect, it, vi } from 'vitest'

const launchAutomatorMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('../src/cli/automator', async () => {
  const actual = await vi.importActual<typeof import('../src/cli/automator')>('../src/cli/automator')
  return {
    ...actual,
    launchAutomator: launchAutomatorMock,
  }
})

vi.mock('../src/logger', () => ({
  default: loggerMock,
}))

describe('automator session diagnostics', () => {
  beforeEach(() => {
    vi.resetModules()
    launchAutomatorMock.mockReset()
    loggerMock.error.mockReset()
    loggerMock.warn.mockReset()
  })

  it('maps websocket connect failures to a friendly diagnostic error', async () => {
    launchAutomatorMock.mockRejectedValueOnce(new Error('Failed connecting to ws://127.0.0.1:9420, check if target project window is opened with automation enabled'))
    const { connectMiniProgram } = await import('../src/cli/automator-session')

    await expect(connectMiniProgram({ projectPath: '/workspace/project' })).rejects.toThrow('DEVTOOLS_WS_CONNECT_ERROR')
    expect(loggerMock.error).toHaveBeenCalledWith('无法连接到当前项目的微信开发者工具自动化 websocket。')
    expect(loggerMock.warn).toHaveBeenCalledWith(expect.stringContaining('wechatwebdevtools cli auto --project'))
  })

  it('maps protocol request timeouts to a friendly diagnostic error', async () => {
    launchAutomatorMock.mockRejectedValueOnce(Object.assign(
      new Error('DevTools did not respond to protocol method App.getCurrentPage within 30000ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.getCurrentPage',
      },
    ))
    const { connectMiniProgram } = await import('../src/cli/automator-session')

    await expect(connectMiniProgram({ projectPath: '/workspace/project' })).rejects.toThrow('DEVTOOLS_PROTOCOL_TIMEOUT')
    expect(loggerMock.error).toHaveBeenCalledWith('微信开发者工具在协议调用 App.getCurrentPage 上超时，未按预期返回结果。')
    expect(loggerMock.warn).toHaveBeenCalledWith(expect.stringContaining('当前 DevTools 版本'))
  })
})
