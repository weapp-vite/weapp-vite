import { beforeEach, describe, expect, it, vi } from 'vitest'

const parseMock = vi.hoisted(() => vi.fn())
const isWechatIdeLoginRequiredErrorMock = vi.hoisted(() => vi.fn())
const formatWechatIdeLoginRequiredErrorMock = vi.hoisted(() => vi.fn())
const formatRetryHotkeyPromptMock = vi.hoisted(() => vi.fn())
const waitForRetryKeypressMock = vi.hoisted(() => vi.fn())
const getConfigMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))
const colorsMock = vi.hoisted(() => ({
  green: vi.fn((value: string) => value),
  bold: vi.fn((value: string) => value),
}))
const execFileMock = vi.hoisted(() => vi.fn())

vi.mock('weapp-ide-cli', () => ({
  parse: parseMock,
  getConfig: getConfigMock,
  isWechatIdeLoginRequiredError: isWechatIdeLoginRequiredErrorMock,
  formatWechatIdeLoginRequiredError: formatWechatIdeLoginRequiredErrorMock,
  formatRetryHotkeyPrompt: formatRetryHotkeyPromptMock,
  waitForRetryKeypress: waitForRetryKeypressMock,
}))

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}))

vi.mock('../logger', () => ({
  default: loggerMock,
  colors: colorsMock,
}))

describe('openIde', () => {
  beforeEach(() => {
    parseMock.mockReset()
    isWechatIdeLoginRequiredErrorMock.mockReset()
    formatWechatIdeLoginRequiredErrorMock.mockReset()
    formatRetryHotkeyPromptMock.mockReset()
    waitForRetryKeypressMock.mockReset()
    getConfigMock.mockReset()
    loggerMock.info.mockReset()
    loggerMock.warn.mockReset()
    loggerMock.error.mockReset()
    execFileMock.mockReset()
    colorsMock.green.mockClear()
    colorsMock.bold.mockClear()

    parseMock.mockResolvedValue(undefined)
    isWechatIdeLoginRequiredErrorMock.mockReturnValue(false)
    getConfigMock.mockResolvedValue({
      cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    })
    formatWechatIdeLoginRequiredErrorMock.mockReturnValue('微信开发者工具返回登录错误：\n- code: 10\n- message: 需要重新登录')
    formatRetryHotkeyPromptMock.mockReturnValue('按 r 重试，按 q / Esc / Ctrl+C 退出。')
    waitForRetryKeypressMock.mockResolvedValue(false)
    execFileMock.mockImplementation((_file: string, _args: string[], callback: (error: any, stdout?: string, stderr?: string) => void) => {
      callback(null, '', '')
      return {} as any
    })
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

  it('passes close command to weapp-ide-cli parse', async () => {
    const { closeIde } = await import('./openIde')
    await closeIde()

    expect(parseMock).toHaveBeenCalledWith([
      'close',
    ])
  })

  it('falls back to AppleScript when close command fails on macOS', async () => {
    const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    parseMock.mockRejectedValueOnce(new Error('close failed'))

    try {
      const { closeIde } = await import('./openIde')
      const result = await closeIde()

      expect(result).toBe(true)
      expect(execFileMock).toHaveBeenCalledWith(
        'osascript',
        ['-e', 'tell application "wechatwebdevtools" to quit'],
        expect.any(Function),
      )
    }
    finally {
      if (platformDescriptor) {
        Object.defineProperty(process, 'platform', platformDescriptor)
      }
    }
  })

  it('falls back to process kill when AppleScript close also fails', async () => {
    const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    parseMock.mockRejectedValueOnce(new Error('close failed'))
    let callCount = 0
    execFileMock.mockImplementation((_file: string, args: string[], callback: (error: any, stdout?: string, stderr?: string) => void) => {
      callCount += 1
      if (callCount === 1) {
        callback(new Error('osascript failed'))
        return {} as any
      }
      callback(null, '', '')
      expect(args).toEqual(['-f', '/Applications/wechatwebdevtools.app'])
      return {} as any
    })

    try {
      const { closeIde } = await import('./openIde')
      const result = await closeIde()

      expect(result).toBe(true)
      expect(execFileMock).toHaveBeenCalledTimes(2)
      expect(execFileMock.mock.calls[1][0]).toBe('pkill')
    }
    finally {
      if (platformDescriptor) {
        Object.defineProperty(process, 'platform', platformDescriptor)
      }
    }
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
    expect(loggerMock.warn).toHaveBeenCalledWith('微信开发者工具返回登录错误：\n- code: 10\n- message: 需要重新登录')
    expect(loggerMock.info).toHaveBeenCalledWith('按 r 重试，按 q / Esc / Ctrl+C 退出。')
    expect(loggerMock.info).toHaveBeenCalledWith('正在重试连接微信开发者工具...')
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
    expect(loggerMock.warn).toHaveBeenCalledWith('已取消重试。完成登录后请重新执行当前命令。')
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
    const { resolveIdeProjectPath, resolveIdeProjectRoot } = await import('./openIde')

    expect(resolveIdeProjectPath('dist/alipay/dist')).toBe('dist/alipay')
    expect(resolveIdeProjectPath('dist')).toBeUndefined()
    expect(resolveIdeProjectPath('')).toBeUndefined()
    expect(resolveIdeProjectRoot('dist', '/workspace/project')).toBe('/workspace/project')
  })

  it('falls back to adapter default project root when config loading fails for alipay', async () => {
    const { resolveIdeCommandContext } = await import('./openIde')

    const result = await resolveIdeCommandContext({
      cwd: '/workspace/project',
      platform: 'alipay',
    })

    expect(result).toEqual({
      platform: 'alipay',
      projectPath: 'dist/alipay',
    })
  })
})
