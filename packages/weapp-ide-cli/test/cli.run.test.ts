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
const getConfiguredLocaleMock = vi.hoisted(() => vi.fn())
const createLocaleConfigMock = vi.hoisted(() => vi.fn())
const createCustomConfigMock = vi.hoisted(() => vi.fn())
const overwriteCustomConfigMock = vi.hoisted(() => vi.fn())
const readCustomConfigMock = vi.hoisted(() => vi.fn())
const removeCustomConfigKeyMock = vi.hoisted(() => vi.fn())
const fsExtraMock = vi.hoisted(() => ({
  pathExists: vi.fn(),
  writeJSON: vi.fn(),
  readJSON: vi.fn(),
}))
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

vi.mock('../src/config/resolver', () => ({
  getConfiguredLocale: getConfiguredLocaleMock,
}))

vi.mock('../src/config/custom', () => ({
  createLocaleConfig: createLocaleConfigMock,
  createCustomConfig: createCustomConfigMock,
  overwriteCustomConfig: overwriteCustomConfigMock,
  readCustomConfig: readCustomConfigMock,
  removeCustomConfigKey: removeCustomConfigKeyMock,
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
  colors: {
    green: (value: string) => value,
  },
}))

vi.mock('fs-extra', () => ({
  default: fsExtraMock,
  pathExists: fsExtraMock.pathExists,
  writeJSON: fsExtraMock.writeJSON,
  readJSON: fsExtraMock.readJSON,
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
    getConfiguredLocaleMock.mockReset()
    createLocaleConfigMock.mockReset()
    createCustomConfigMock.mockReset()
    overwriteCustomConfigMock.mockReset()
    readCustomConfigMock.mockReset()
    removeCustomConfigKeyMock.mockReset()
    fsExtraMock.pathExists.mockReset()
    fsExtraMock.writeJSON.mockReset()
    fsExtraMock.readJSON.mockReset()
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
    getConfiguredLocaleMock.mockResolvedValue(undefined)
    createLocaleConfigMock.mockResolvedValue(undefined)
    createCustomConfigMock.mockResolvedValue('/workspace/project/cli')
    overwriteCustomConfigMock.mockResolvedValue(undefined)
    readCustomConfigMock.mockResolvedValue({})
    removeCustomConfigKeyMock.mockResolvedValue(undefined)
    fsExtraMock.pathExists.mockResolvedValue(true)
    fsExtraMock.writeJSON.mockResolvedValue(undefined)
    fsExtraMock.readJSON.mockResolvedValue({})
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

  it('prints automator command help via "help <command>"', async () => {
    const { parse } = await loadRunModule()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await parse(['help', 'navigate'])

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Usage: weapp navigate <url> -p <project-path>'))
    expect(resolveCliPathMock).not.toHaveBeenCalled()
    expect(executeMock).not.toHaveBeenCalled()
    logSpy.mockRestore()
  })

  it('prints english help when --lang en is provided', async () => {
    const { parse } = await loadRunModule()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await parse(['help', 'navigate', '--lang', 'en'])

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Navigate to a page'))
    logSpy.mockRestore()
  })

  it('uses configured locale when command does not pass --lang', async () => {
    const { parse } = await loadRunModule()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    getConfiguredLocaleMock.mockResolvedValue('en')

    await parse(['help', 'navigate'])

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Navigate to a page'))
    logSpy.mockRestore()
  })

  it('supports switching locale via config command', async () => {
    const { parse } = await loadRunModule()

    await parse(['config', 'lang', 'en'])

    expect(createLocaleConfigMock).toHaveBeenCalledWith('en')
    expect(executeMock).not.toHaveBeenCalled()
    expect(resolveCliPathMock).not.toHaveBeenCalled()
  })

  it('supports showing config via config show', async () => {
    const { parse } = await loadRunModule()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    readCustomConfigMock.mockResolvedValue({
      cliPath: '/custom/cli',
      locale: 'en',
    })

    await parse(['config', 'show'])

    expect(readCustomConfigMock).toHaveBeenCalledTimes(1)
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({
      cliPath: '/custom/cli',
      locale: 'en',
    }, null, 2))
    logSpy.mockRestore()
  })

  it('supports reading config key via config get', async () => {
    const { parse } = await loadRunModule()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    readCustomConfigMock.mockResolvedValue({
      locale: 'en',
    })

    await parse(['config', 'get', 'locale'])

    expect(logSpy).toHaveBeenCalledWith('en')
    logSpy.mockRestore()
  })

  it('supports setting cliPath via config set', async () => {
    const { parse } = await loadRunModule()

    await parse(['config', 'set', 'cliPath', './tools/cli'])

    expect(createCustomConfigMock).toHaveBeenCalledWith({ cliPath: './tools/cli' })
    expect(executeMock).not.toHaveBeenCalled()
  })

  it('supports clearing locale via config unset', async () => {
    const { parse } = await loadRunModule()

    await parse(['config', 'unset', 'locale'])

    expect(removeCustomConfigKeyMock).toHaveBeenCalledWith('locale')
    expect(executeMock).not.toHaveBeenCalled()
  })

  it('supports config doctor diagnostics output', async () => {
    const { parse } = await loadRunModule()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    readCustomConfigMock.mockResolvedValue({
      cliPath: '/custom/cli',
      locale: 'zh',
    })
    resolveCliPathMock.mockResolvedValue({
      cliPath: '/custom/cli',
      source: 'custom',
    })

    await parse(['config', 'doctor'])

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"cliPathValid": true'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"locale": "zh"'))
    logSpy.mockRestore()
  })

  it('supports config export to file', async () => {
    const { parse } = await loadRunModule()
    readCustomConfigMock.mockResolvedValue({
      locale: 'en',
    })

    await parse(['config', 'export', '/tmp/weapp-config.json'])

    expect(fsExtraMock.writeJSON).toHaveBeenCalledWith(
      '/tmp/weapp-config.json',
      { locale: 'en' },
      { spaces: 2, encoding: 'utf8' },
    )
  })

  it('supports config import from file', async () => {
    const { parse } = await loadRunModule()
    fsExtraMock.readJSON.mockResolvedValue({
      cliPath: '/imported/cli',
      locale: 'en',
    })

    await parse(['config', 'import', '/tmp/weapp-config.json'])

    expect(fsExtraMock.readJSON).toHaveBeenCalledWith('/tmp/weapp-config.json')
    expect(overwriteCustomConfigMock).toHaveBeenCalledWith({
      cliPath: '/imported/cli',
      locale: 'en',
    })
  })

  it('fails fast when --lang is invalid', async () => {
    const { parse } = await loadRunModule()

    await expect(parse(['help', 'navigate', '--lang', 'fr'])).rejects.toThrow(
      '不支持的语言: fr，仅支持 zh 或 en',
    )

    expect(resolveCliPathMock).not.toHaveBeenCalled()
    expect(executeMock).not.toHaveBeenCalled()
  })

  it('fails fast when upload misses required version/desc arguments', async () => {
    const { parse } = await loadRunModule()

    await expect(parse(['upload', '-p', './mini-app'])).rejects.toThrow(
      'upload 命令缺少必填参数：--version/-v 和 --desc/-d',
    )

    expect(executeMock).not.toHaveBeenCalled()
  })

  it('fails fast when preview qr-format is invalid', async () => {
    const { parse } = await loadRunModule()

    await expect(parse(['preview', '-p', './mini-app', '--qr-format', 'svg'])).rejects.toThrow(
      'preview 命令的二维码格式无效: svg（仅支持 terminal/image/base64）',
    )

    expect(executeMock).not.toHaveBeenCalled()
  })

  it('fails fast when --port is invalid', async () => {
    const { parse } = await loadRunModule()

    await expect(parse(['open', '--port', 'abc'])).rejects.toThrow(
      '无效的 --port 值: abc（必须为正整数）',
    )

    expect(executeMock).not.toHaveBeenCalled()
  })

  it('fails fast when preview misses both --project and --appid', async () => {
    const { parse } = await loadRunModule()

    await expect(parse(['preview'])).rejects.toThrow(
      'preview 命令需要提供 --project 或 --appid',
    )

    expect(executeMock).not.toHaveBeenCalled()
  })

  it('fails fast when auto-preview misses both --project and --appid', async () => {
    const { parse } = await loadRunModule()

    await expect(parse(['auto-preview'])).rejects.toThrow(
      'auto-preview 命令需要提供 --project 或 --appid',
    )

    expect(executeMock).not.toHaveBeenCalled()
  })

  it('fails fast when --ext-appid is used without --appid and --project', async () => {
    const { parse } = await loadRunModule()

    await expect(parse(['preview', '--ext-appid', 'wx123'])).rejects.toThrow(
      '--ext-appid 需要和 --appid 一起使用（当未提供 --project 时）',
    )

    expect(executeMock).not.toHaveBeenCalled()
  })

  it('allows --ext-appid when --appid is provided', async () => {
    const { parse } = await loadRunModule()

    await parse(['preview', '--appid', 'wx123', '--ext-appid', 'wx456'])

    expect(executeMock).toHaveBeenCalledTimes(1)
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

  it('fails fast when --login-retry is invalid', async () => {
    const { parse } = await loadRunModule()

    await expect(parse(['open', '--login-retry', 'twice'])).rejects.toThrow(
      '不支持的 --login-retry 值: twice（仅支持 never/once/always）',
    )

    expect(executeMock).not.toHaveBeenCalled()
  })

  it('fails fast when --login-retry-timeout is invalid', async () => {
    const { parse } = await loadRunModule()

    await expect(parse(['open', '--login-retry-timeout', '0'])).rejects.toThrow(
      '无效的 --login-retry-timeout 值: 0（必须为正整数）',
    )

    expect(executeMock).not.toHaveBeenCalled()
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
