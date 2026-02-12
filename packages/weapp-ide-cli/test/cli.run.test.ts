import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runMinidevMock = vi.hoisted(() => vi.fn())
const resolveCliPathMock = vi.hoisted(() => vi.fn())
const promptForCliPathMock = vi.hoisted(() => vi.fn())
const isOperatingSystemSupportedMock = vi.hoisted(() => vi.fn())
const executeMock = vi.hoisted(() => vi.fn())
const isWechatIdeLoginRequiredErrorMock = vi.hoisted(() => vi.fn())
const formatWechatIdeLoginRequiredErrorMock = vi.hoisted(() => vi.fn())
const formatRetryHotkeyPromptMock = vi.hoisted(() => vi.fn())
const waitForRetryKeypressMock = vi.hoisted(() => vi.fn())
const createWechatIdeLoginRequiredExitErrorMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  start: vi.fn(),
}))
const mockCwd = '/workspace/project'

vi.mock('../src/cli/minidev', () => ({
  runMinidev: runMinidevMock,
}))

vi.mock('../src/cli/resolver', () => ({
  resolveCliPath: resolveCliPathMock,
}))

vi.mock('../src/cli/prompt', () => ({
  promptForCliPath: promptForCliPathMock,
}))

vi.mock('../src/runtime/platform', () => ({
  isOperatingSystemSupported: isOperatingSystemSupportedMock,
  operatingSystemName: 'Darwin',
}))

vi.mock('../src/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils')>()
  return {
    ...actual,
    execute: executeMock,
  }
})

vi.mock('../src/cli/retry', () => ({
  isWechatIdeLoginRequiredError: isWechatIdeLoginRequiredErrorMock,
  formatWechatIdeLoginRequiredError: formatWechatIdeLoginRequiredErrorMock,
  formatRetryHotkeyPrompt: formatRetryHotkeyPromptMock,
  waitForRetryKeypress: waitForRetryKeypressMock,
  createWechatIdeLoginRequiredExitError: createWechatIdeLoginRequiredExitErrorMock,
}))

vi.mock('../src/logger', () => ({
  default: loggerMock,
}))

async function loadRunModule() {
  return import('../src/cli/run')
}

describe('cli parsing', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>
  let originalStdinIsTTY: PropertyDescriptor | undefined

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('CI', '')
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(mockCwd)
    originalStdinIsTTY = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: true,
    })
    runMinidevMock.mockReset()
    resolveCliPathMock.mockReset()
    promptForCliPathMock.mockReset()
    loggerMock.log.mockReset()
    loggerMock.warn.mockReset()
    loggerMock.error.mockReset()
    loggerMock.info.mockReset()
    loggerMock.start.mockReset()
    isOperatingSystemSupportedMock.mockReset()
    executeMock.mockReset()
    isWechatIdeLoginRequiredErrorMock.mockReset()
    formatWechatIdeLoginRequiredErrorMock.mockReset()
    formatRetryHotkeyPromptMock.mockReset()
    waitForRetryKeypressMock.mockReset()
    createWechatIdeLoginRequiredExitErrorMock.mockReset()
    isOperatingSystemSupportedMock.mockReturnValue(true)
    executeMock.mockResolvedValue(undefined)
    isWechatIdeLoginRequiredErrorMock.mockReturnValue(false)
    formatWechatIdeLoginRequiredErrorMock.mockReturnValue('微信开发者工具返回登录错误：\n- code: 10\n- message: 需要重新登录')
    formatRetryHotkeyPromptMock.mockReturnValue('按 r 重试，按 q / Esc / Ctrl+C 退出。')
    waitForRetryKeypressMock.mockResolvedValue('cancel')
    createWechatIdeLoginRequiredExitErrorMock.mockImplementation((errorLike: unknown) => {
      const next = new Error('登录失效') as Error & { code: number, exitCode: number }
      next.code = 10
      next.exitCode = 10
      if (errorLike && typeof errorLike === 'object' && typeof (errorLike as any).message === 'string') {
        next.message = (errorLike as any).message
      }
      return next
    })
    resolveCliPathMock.mockResolvedValue({
      cliPath: '/Applications/wechat-cli',
      source: 'default',
    })
  })

  afterEach(() => {
    cwdSpy.mockRestore()
    if (originalStdinIsTTY) {
      Object.defineProperty(process.stdin, 'isTTY', originalStdinIsTTY)
    }
    else {
      delete (process.stdin as any).isTTY
    }
    vi.unstubAllEnvs()
  })

  it('delegates alipay namespace to minidev runner', async () => {
    const { parse } = await loadRunModule()
    runMinidevMock.mockResolvedValue(undefined)

    await parse(['alipay', 'login'])

    expect(runMinidevMock).toHaveBeenCalledWith(['login'])
    expect(resolveCliPathMock).not.toHaveBeenCalled()
    expect(isOperatingSystemSupportedMock).not.toHaveBeenCalled()
  })

  it('supports ali alias for minidev runner', async () => {
    const { parse } = await loadRunModule()
    runMinidevMock.mockResolvedValue(undefined)

    await parse(['ali', 'open'])

    expect(runMinidevMock).toHaveBeenCalledWith(['open'])
  })

  it('delegates open --platform alipay to minidev ide command', async () => {
    const { parse } = await loadRunModule()
    runMinidevMock.mockResolvedValue(undefined)

    await parse(['open', '--platform', 'alipay', '-p', './dist/dev/mp-alipay'])

    expect(runMinidevMock).toHaveBeenCalledWith([
      'ide',
      '--project',
      `${mockCwd}/dist/dev/mp-alipay`,
    ])
    expect(resolveCliPathMock).not.toHaveBeenCalled()
    expect(isOperatingSystemSupportedMock).not.toHaveBeenCalled()
  })

  it('supports --platform=ali style when delegating open to minidev', async () => {
    const { parse } = await loadRunModule()
    runMinidevMock.mockResolvedValue(undefined)

    await parse(['open', '--platform=ali', '-p'])

    expect(runMinidevMock).toHaveBeenCalledWith([
      'ide',
      '--project',
      mockCwd,
    ])
  })

  it('retries wechat cli execution when thrown error indicates login required', async () => {
    const { parse } = await loadRunModule()
    const loginRequiredError = new Error('需要重新登录 (code 10)')

    executeMock
      .mockRejectedValueOnce(loginRequiredError)
      .mockResolvedValueOnce(undefined)
    isWechatIdeLoginRequiredErrorMock
      .mockReturnValueOnce(true)
      .mockReturnValue(false)
    waitForRetryKeypressMock.mockResolvedValue('retry')

    await parse(['open', '-p', './mini-app'])

    expect(executeMock).toHaveBeenCalledWith('/Applications/wechat-cli', ['open', '--project', `${mockCwd}/mini-app`], {
      pipeStdout: false,
      pipeStderr: false,
    })
    expect(executeMock).toHaveBeenCalledTimes(2)
    expect(waitForRetryKeypressMock).toHaveBeenCalledTimes(1)
    expect(loggerMock.error).toHaveBeenCalledWith('检测到微信开发者工具登录状态失效，请先登录后重试。')
    expect(loggerMock.info).toHaveBeenCalledWith('正在重试连接微信开发者工具...')
  })

  it('retries when execution output indicates login required', async () => {
    const { parse } = await loadRunModule()

    executeMock
      .mockResolvedValueOnce({ stderr: '[error] code: 10\n需要重新登录' })
      .mockResolvedValueOnce(undefined)
    isWechatIdeLoginRequiredErrorMock
      .mockReturnValueOnce(true)
      .mockReturnValue(false)
    waitForRetryKeypressMock.mockResolvedValue('retry')

    await parse(['open'])

    expect(executeMock).toHaveBeenCalledTimes(2)
    expect(waitForRetryKeypressMock).toHaveBeenCalledTimes(1)
    expect(loggerMock.info).toHaveBeenCalledWith('正在重试连接微信开发者工具...')
  })

  it('stops retry loop when login is required and user cancels', async () => {
    const { parse } = await loadRunModule()
    const loginRequiredError = new Error('需要重新登录 (code 10)')

    executeMock.mockRejectedValueOnce(loginRequiredError)
    isWechatIdeLoginRequiredErrorMock.mockReturnValue(true)
    createWechatIdeLoginRequiredExitErrorMock.mockReturnValue(
      Object.assign(new Error('login required'), { code: 10, exitCode: 10 }),
    )
    waitForRetryKeypressMock.mockResolvedValue('cancel')
    createWechatIdeLoginRequiredExitErrorMock.mockImplementation((errorLike: unknown) => {
      const next = new Error('登录失效') as Error & { code: number, exitCode: number }
      next.code = 10
      next.exitCode = 10
      if (errorLike && typeof errorLike === 'object' && typeof (errorLike as any).message === 'string') {
        next.message = (errorLike as any).message
      }
      return next
    })

    await expect(parse(['open'])).rejects.toMatchObject({
      code: 10,
      exitCode: 10,
    })

    expect(executeMock).toHaveBeenCalledTimes(1)
    expect(waitForRetryKeypressMock).toHaveBeenCalledTimes(1)
    expect(loggerMock.info).toHaveBeenCalledWith('已取消重试。完成登录后请重新执行当前命令。')
  })

  it('fails fast in non-interactive mode when login is required', async () => {
    const { parse } = await loadRunModule()
    const loginRequiredError = new Error('需要重新登录 (code 10)')

    executeMock.mockRejectedValueOnce(loginRequiredError)
    isWechatIdeLoginRequiredErrorMock.mockReturnValue(true)
    createWechatIdeLoginRequiredExitErrorMock.mockReturnValue(
      Object.assign(new Error('login required'), { code: 10, exitCode: 10 }),
    )

    await expect(parse(['open', '--non-interactive'])).rejects.toMatchObject({
      code: 10,
      exitCode: 10,
    })

    expect(waitForRetryKeypressMock).not.toHaveBeenCalled()
    expect(loggerMock.error).toHaveBeenCalledWith('当前为非交互模式，检测到登录失效后直接失败。')
  })

  it('auto enables non-interactive mode in CI environment', async () => {
    const { parse } = await loadRunModule()
    const loginRequiredError = new Error('需要重新登录 (code 10)')

    vi.stubEnv('CI', 'true')
    executeMock.mockRejectedValueOnce(loginRequiredError)
    isWechatIdeLoginRequiredErrorMock.mockReturnValue(true)
    createWechatIdeLoginRequiredExitErrorMock.mockReturnValue(
      Object.assign(new Error('login required'), { code: 10, exitCode: 10 }),
    )

    await expect(parse(['open'])).rejects.toMatchObject({
      code: 10,
      exitCode: 10,
    })

    expect(waitForRetryKeypressMock).not.toHaveBeenCalled()
  })

  it('auto enables non-interactive mode for non-tty stdin', async () => {
    const { parse } = await loadRunModule()
    const loginRequiredError = new Error('需要重新登录 (code 10)')

    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: false,
    })
    executeMock.mockRejectedValueOnce(loginRequiredError)
    isWechatIdeLoginRequiredErrorMock.mockReturnValue(true)

    await expect(parse(['open'])).rejects.toMatchObject({
      code: 10,
      exitCode: 10,
    })

    expect(waitForRetryKeypressMock).not.toHaveBeenCalled()
  })

  it('respects --login-retry=once and only retries once', async () => {
    const { parse } = await loadRunModule()

    executeMock
      .mockResolvedValueOnce({ stderr: '[error] code: 10\n需要重新登录' })
      .mockResolvedValueOnce({ stderr: '[error] code: 10\n需要重新登录' })
    isWechatIdeLoginRequiredErrorMock.mockReturnValue(true)
    waitForRetryKeypressMock.mockResolvedValue('retry')
    createWechatIdeLoginRequiredExitErrorMock.mockReturnValue(
      Object.assign(new Error('login required'), { code: 10, exitCode: 10 }),
    )

    await expect(parse(['open', '--login-retry=once'])).rejects.toMatchObject({
      code: 10,
      exitCode: 10,
    })

    expect(waitForRetryKeypressMock).toHaveBeenCalledTimes(1)
    expect(executeMock).toHaveBeenCalledTimes(2)
  })

  it('respects --login-retry=never and skips keypress prompt', async () => {
    const { parse } = await loadRunModule()

    executeMock.mockResolvedValueOnce({ stderr: '[error] code: 10\n需要重新登录' })
    isWechatIdeLoginRequiredErrorMock.mockReturnValue(true)
    createWechatIdeLoginRequiredExitErrorMock.mockReturnValue(
      Object.assign(new Error('login required'), { code: 10, exitCode: 10 }),
    )

    await expect(parse(['open', '--login-retry=never'])).rejects.toMatchObject({
      code: 10,
      exitCode: 10,
    })

    expect(waitForRetryKeypressMock).not.toHaveBeenCalled()
  })

  it('passes custom login retry timeout to keypress prompt', async () => {
    const { parse } = await loadRunModule()

    executeMock.mockResolvedValueOnce({ stderr: '[error] code: 10\n需要重新登录' })
    isWechatIdeLoginRequiredErrorMock.mockReturnValue(true)
    waitForRetryKeypressMock.mockResolvedValue('timeout')
    createWechatIdeLoginRequiredExitErrorMock.mockReturnValue(
      Object.assign(new Error('login required'), { code: 10, exitCode: 10 }),
    )

    await expect(parse(['open', '--login-retry-timeout=1234'])).rejects.toMatchObject({
      code: 10,
      exitCode: 10,
    })

    expect(formatRetryHotkeyPromptMock).toHaveBeenCalledWith(1234)
    expect(waitForRetryKeypressMock).toHaveBeenCalledWith({ timeoutMs: 1234 })
    expect(loggerMock.error).toHaveBeenCalledWith('等待登录重试输入超时（1234ms），已自动取消。')
  })
})
