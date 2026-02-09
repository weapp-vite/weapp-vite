import { beforeEach, describe, expect, it, vi } from 'vitest'

const parseMock = vi.hoisted(() => vi.fn())
const isWechatIdeLoginRequiredErrorMock = vi.hoisted(() => vi.fn())
const formatWechatIdeLoginRequiredErrorMock = vi.hoisted(() => vi.fn())
const formatRetryHotkeyPromptMock = vi.hoisted(() => vi.fn())
const waitForRetryKeypressMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

vi.mock('weapp-ide-cli', () => ({
  parse: parseMock,
  isWechatIdeLoginRequiredError: isWechatIdeLoginRequiredErrorMock,
  formatWechatIdeLoginRequiredError: formatWechatIdeLoginRequiredErrorMock,
  formatRetryHotkeyPrompt: formatRetryHotkeyPromptMock,
  waitForRetryKeypress: waitForRetryKeypressMock,
}))

vi.mock('../logger', () => ({
  default: loggerMock,
}))

describe('openIde', () => {
  beforeEach(() => {
    parseMock.mockReset()
    isWechatIdeLoginRequiredErrorMock.mockReset()
    formatWechatIdeLoginRequiredErrorMock.mockReset()
    formatRetryHotkeyPromptMock.mockReset()
    waitForRetryKeypressMock.mockReset()
    loggerMock.log.mockReset()
    loggerMock.warn.mockReset()
    loggerMock.error.mockReset()

    parseMock.mockResolvedValue(undefined)
    isWechatIdeLoginRequiredErrorMock.mockReturnValue(false)
    formatWechatIdeLoginRequiredErrorMock.mockReturnValue('微信开发者工具返回登录错误：\n- code: 10\n- message: 需要重新登录')
    formatRetryHotkeyPromptMock.mockReturnValue('按 r 重试，按 q / Esc / Ctrl+C 退出。')
    waitForRetryKeypressMock.mockResolvedValue(false)
  })

  it('passes project path and alipay platform to weapp-ide-cli parse', async () => {
    const { openIde } = await import('./openIde')
    await openIde('alipay', 'dist/alipay')

    expect(parseMock).toHaveBeenCalledWith([
      'open',
      '-p',
      'dist/alipay',
      '--platform',
      'alipay',
    ])
  })

  it('does not append platform for non-alipay', async () => {
    const { openIde } = await import('./openIde')
    await openIde('weapp', 'dist/dev/mp-weixin')

    expect(parseMock).toHaveBeenCalledWith([
      'open',
      '-p',
      'dist/dev/mp-weixin',
    ])
  })

  it('retries open flow when login is required and user presses r', async () => {
    const { openIde } = await import('./openIde')
    const loginRequiredError = new Error('需要重新登录 (code 10)')

    parseMock
      .mockRejectedValueOnce(loginRequiredError)
      .mockResolvedValueOnce(undefined)
    isWechatIdeLoginRequiredErrorMock.mockReturnValue(true)
    waitForRetryKeypressMock.mockResolvedValue(true)

    await openIde('weapp', 'dist/dev/mp-weixin')

    expect(parseMock).toHaveBeenCalledTimes(2)
    expect(waitForRetryKeypressMock).toHaveBeenCalledTimes(1)
    expect(loggerMock.error).toHaveBeenCalledWith('检测到微信开发者工具登录状态失效，请先登录后重试。')
    expect(loggerMock.log).toHaveBeenCalledWith('微信开发者工具返回登录错误：\n- code: 10\n- message: 需要重新登录')
    expect(loggerMock.log).toHaveBeenCalledWith('按 r 重试，按 q / Esc / Ctrl+C 退出。')
    expect(loggerMock.log).toHaveBeenCalledWith('正在重试连接微信开发者工具...')
  })

  it('stops retry loop when login is required and user cancels', async () => {
    const { openIde } = await import('./openIde')
    const loginRequiredError = new Error('需要重新登录 (code 10)')

    parseMock.mockRejectedValueOnce(loginRequiredError)
    isWechatIdeLoginRequiredErrorMock.mockReturnValue(true)
    waitForRetryKeypressMock.mockResolvedValue(false)

    await openIde('weapp', 'dist/dev/mp-weixin')

    expect(parseMock).toHaveBeenCalledTimes(1)
    expect(waitForRetryKeypressMock).toHaveBeenCalledTimes(1)
    expect(loggerMock.log).toHaveBeenCalledWith('已取消重试。完成登录后请重新执行当前命令。')
  })

  it('prints original error for non-login failures', async () => {
    const { openIde } = await import('./openIde')
    const error = new Error('unexpected execution failure')

    parseMock.mockRejectedValueOnce(error)
    isWechatIdeLoginRequiredErrorMock.mockReturnValue(false)

    await openIde('weapp', 'dist/dev/mp-weixin')

    expect(loggerMock.error).toHaveBeenCalledWith(error)
    expect(waitForRetryKeypressMock).not.toHaveBeenCalled()
  })

  it('resolves ide project path from mpDistRoot', async () => {
    const { resolveIdeProjectPath } = await import('./openIde')

    expect(resolveIdeProjectPath('dist/alipay/dist')).toBe('dist/alipay')
    expect(resolveIdeProjectPath('dist')).toBeUndefined()
    expect(resolveIdeProjectPath('')).toBeUndefined()
  })
})
