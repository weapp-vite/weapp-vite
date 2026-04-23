import { beforeEach, describe, expect, it, vi } from 'vitest'

const parseMock = vi.hoisted(() => vi.fn())
const closeWechatIdeProjectMock = vi.hoisted(() => vi.fn())
const isAutomatorLoginErrorMock = vi.hoisted(() => vi.fn())
const formatAutomatorLoginErrorMock = vi.hoisted(() => vi.fn())
const isWechatIdeLoginRequiredErrorMock = vi.hoisted(() => vi.fn())
const promptWechatIdeLoginRetryMock = vi.hoisted(() => vi.fn())
const promptRetryKeypressMock = vi.hoisted(() => vi.fn())
const runWithSuspendedSharedInputMock = vi.hoisted(() => vi.fn())
const runRetryableCommandMock = vi.hoisted(() => vi.fn())
const withMiniProgramMock = vi.hoisted(() => vi.fn())
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
const createCompilerContextMock = vi.hoisted(() => vi.fn())
const createInlineConfigMock = vi.hoisted(() => vi.fn((platform?: string) => ({ platform })))
const miniProgramDisconnectMock = vi.hoisted(() => vi.fn())
const connectOpenedAutomatorMock = vi.hoisted(() => vi.fn())
const launchAutomatorMock = vi.hoisted(() => vi.fn())
const bootstrapWechatDevtoolsSettingsMock = vi.hoisted(() => vi.fn())

vi.mock('weapp-ide-cli', () => ({
  bootstrapWechatDevtoolsSettings: bootstrapWechatDevtoolsSettingsMock,
  closeWechatIdeProject: closeWechatIdeProjectMock,
  connectOpenedAutomator: connectOpenedAutomatorMock,
  formatAutomatorLoginError: formatAutomatorLoginErrorMock,
  parse: parseMock,
  getConfig: getConfigMock,
  isAutomatorLoginError: isAutomatorLoginErrorMock,
  isWechatIdeLoginRequiredError: isWechatIdeLoginRequiredErrorMock,
  launchAutomator: launchAutomatorMock,
  promptWechatIdeLoginRetry: promptWechatIdeLoginRetryMock,
  promptRetryKeypress: promptRetryKeypressMock,
  runWithSuspendedSharedInput: runWithSuspendedSharedInputMock,
  runRetryableCommand: runRetryableCommandMock,
  withMiniProgram: withMiniProgramMock,
}))

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}))

vi.mock('../createContext', () => ({
  createCompilerContext: createCompilerContextMock,
}))

vi.mock('./runtime', () => ({
  createInlineConfig: createInlineConfigMock,
}))

vi.mock('../logger', () => ({
  default: loggerMock,
  colors: colorsMock,
}))

describe('openIde', () => {
  beforeEach(() => {
    parseMock.mockReset()
    closeWechatIdeProjectMock.mockReset()
    isAutomatorLoginErrorMock.mockReset()
    formatAutomatorLoginErrorMock.mockReset()
    isWechatIdeLoginRequiredErrorMock.mockReset()
    promptWechatIdeLoginRetryMock.mockReset()
    promptRetryKeypressMock.mockReset()
    runWithSuspendedSharedInputMock.mockReset()
    runRetryableCommandMock.mockReset()
    withMiniProgramMock.mockReset()
    getConfigMock.mockReset()
    loggerMock.info.mockReset()
    loggerMock.warn.mockReset()
    loggerMock.error.mockReset()
    execFileMock.mockReset()
    createCompilerContextMock.mockReset()
    miniProgramDisconnectMock.mockReset()
    connectOpenedAutomatorMock.mockReset()
    launchAutomatorMock.mockReset()
    bootstrapWechatDevtoolsSettingsMock.mockReset()
    createInlineConfigMock.mockClear()
    colorsMock.green.mockClear()
    colorsMock.bold.mockClear()
    delete process.env.WEAPP_VITE_DEBUG_AUTOMATOR_OPEN

    parseMock.mockResolvedValue(undefined)
    closeWechatIdeProjectMock.mockResolvedValue(undefined)
    isAutomatorLoginErrorMock.mockReturnValue(false)
    isWechatIdeLoginRequiredErrorMock.mockReturnValue(false)
    formatAutomatorLoginErrorMock.mockReturnValue('微信开发者工具返回登录错误：\n- code: 10\n- message: 需要重新登录')
    getConfigMock.mockResolvedValue({
      cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    })
    promptWechatIdeLoginRetryMock.mockResolvedValue('cancel')
    promptRetryKeypressMock.mockResolvedValue('cancel')
    runWithSuspendedSharedInputMock.mockImplementation(async (runner: () => Promise<unknown>) => await runner())
    withMiniProgramMock.mockRejectedValue(new Error('no automator'))
    runRetryableCommandMock.mockImplementation(async (options) => {
      const result = await options.execute()
      if (!options.isRetryableResult(result)) {
        return result
      }

      const action = await options.promptRetry(result, 0)
      if (options.shouldRetry(action)) {
        options.onRetry?.()
        return await options.execute()
      }

      options.onCancel?.(result)
      throw options.createCancelError(result)
    })
    execFileMock.mockImplementation((_file: string, _args: string[], callback: (error: any, stdout?: string, stderr?: string) => void) => {
      callback(null, '', '')
      return {} as any
    })
    createCompilerContextMock.mockRejectedValue(new Error('load config failed'))
    connectOpenedAutomatorMock.mockRejectedValue(new Error('connect failed'))
    launchAutomatorMock.mockResolvedValue({
      disconnect: miniProgramDisconnectMock,
    })
    bootstrapWechatDevtoolsSettingsMock.mockResolvedValue({
      touchedInstanceCount: 1,
      detectedSecurityCount: 1,
      updatedSecurityCount: 0,
      trustedProjectCount: 1,
    })
    miniProgramDisconnectMock.mockReset()
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

  it('appends trust-project by default for weapp', async () => {
    const { openIde } = await import('./openIde')
    await openIde('weapp', 'dist/dev/mp-weixin')

    expect(bootstrapWechatDevtoolsSettingsMock).toHaveBeenCalledWith({
      projectPath: 'dist/dev/mp-weixin',
      trustProject: undefined,
    })
    expect(connectOpenedAutomatorMock).toHaveBeenCalledWith({
      projectPath: 'dist/dev/mp-weixin',
      timeout: 3000,
    })
    expect(launchAutomatorMock).toHaveBeenCalledWith({
      projectPath: 'dist/dev/mp-weixin',
      trustProject: true,
    })
    expect(miniProgramDisconnectMock).toHaveBeenCalledTimes(1)
    expect(parseMock).not.toHaveBeenCalled()
  })

  it('skips reopening when current weapp project is already open in devtools', async () => {
    connectOpenedAutomatorMock.mockResolvedValueOnce({
      disconnect: miniProgramDisconnectMock,
    })

    const { openIde } = await import('./openIde')
    await openIde('weapp', 'dist/dev/mp-weixin')

    expect(connectOpenedAutomatorMock).toHaveBeenCalledWith({
      projectPath: 'dist/dev/mp-weixin',
      timeout: 3000,
    })
    expect(miniProgramDisconnectMock).toHaveBeenCalledTimes(1)
    expect(colorsMock.green).toHaveBeenCalledWith('r')
    expect(colorsMock.bold).toHaveBeenCalledWith('r')
    expect(loggerMock.info).toHaveBeenCalledWith('目标项目已在微信开发者工具中打开，已跳过重复打开。按 r 关闭当前窗口后重新打开。')
    expect(launchAutomatorMock).not.toHaveBeenCalled()
    expect(parseMock).not.toHaveBeenCalled()
  })

  it('closes current devtools window and reopens when user presses r for an opened weapp project', async () => {
    connectOpenedAutomatorMock.mockResolvedValueOnce({
      disconnect: miniProgramDisconnectMock,
    })
    promptRetryKeypressMock.mockResolvedValueOnce('retry')

    const { openIde } = await import('./openIde')
    await openIde('weapp', 'dist/dev/mp-weixin')

    expect(connectOpenedAutomatorMock).toHaveBeenCalledWith({
      projectPath: 'dist/dev/mp-weixin',
      timeout: 3000,
    })
    expect(closeWechatIdeProjectMock).toHaveBeenCalledTimes(1)
    expect(colorsMock.green).toHaveBeenCalledWith('r')
    expect(colorsMock.bold).toHaveBeenCalledWith('r')
    expect(loggerMock.info).toHaveBeenCalledWith('目标项目已在微信开发者工具中打开，已跳过重复打开。按 r 关闭当前窗口后重新打开。')
    expect(loggerMock.info).toHaveBeenCalledWith('正在关闭当前已打开项目，并重新拉起微信开发者工具...')
    expect(launchAutomatorMock).toHaveBeenCalledWith({
      projectPath: 'dist/dev/mp-weixin',
      trustProject: true,
    })
  })

  it('reopens current weapp project immediately when reuse is disabled', async () => {
    connectOpenedAutomatorMock.mockResolvedValueOnce({
      disconnect: miniProgramDisconnectMock,
    })

    const { openIde } = await import('./openIde')
    await openIde('weapp', 'dist/dev/mp-weixin', {
      reuseOpenedProject: false,
    })

    expect(connectOpenedAutomatorMock).toHaveBeenCalledWith({
      projectPath: 'dist/dev/mp-weixin',
      timeout: 3000,
    })
    expect(miniProgramDisconnectMock).toHaveBeenCalledTimes(2)
    expect(loggerMock.info).toHaveBeenCalledWith('目标项目已在微信开发者工具中打开，当前命令将主动重开以刷新最新构建产物。')
    expect(closeWechatIdeProjectMock).toHaveBeenCalledTimes(1)
    expect(launchAutomatorMock).toHaveBeenCalledWith({
      projectPath: 'dist/dev/mp-weixin',
      trustProject: true,
    })
  })

  it('does not append trust-project when explicitly disabled', async () => {
    const { openIde } = await import('./openIde')
    await openIde('weapp', 'dist/dev/mp-weixin', { trustProject: false })

    expect(bootstrapWechatDevtoolsSettingsMock).toHaveBeenCalledWith({
      projectPath: 'dist/dev/mp-weixin',
      trustProject: false,
    })
    expect(parseMock).toHaveBeenCalledWith([
      'open',
      '-p',
      'dist/dev/mp-weixin',
    ])
    expect(launchAutomatorMock).not.toHaveBeenCalled()
  })

  it('falls back to weapp open when automator trust launch fails', async () => {
    const { openIde } = await import('./openIde')
    const error = new Error('automator failed')
    launchAutomatorMock.mockRejectedValueOnce(error)

    await openIde('weapp', 'dist/dev/mp-weixin')

    expect(loggerMock.warn).toHaveBeenCalledWith('通过 automator 启动微信开发者工具并自动信任项目失败，回退到普通 open 流程。')
    expect(loggerMock.error).not.toHaveBeenCalledWith(error)
    expect(parseMock).toHaveBeenCalledWith([
      'open',
      '-p',
      'dist/dev/mp-weixin',
      '--trust-project',
    ])
  })

  it('falls back to plain open when detected service port is disabled', async () => {
    bootstrapWechatDevtoolsSettingsMock.mockResolvedValueOnce({
      touchedInstanceCount: 1,
      detectedSecurityCount: 1,
      updatedSecurityCount: 0,
      trustedProjectCount: 1,
      servicePort: 21992,
      servicePortEnabled: false,
    })

    const { openIde } = await import('./openIde')
    await openIde('weapp', 'dist/dev/mp-weixin')

    expect(loggerMock.warn).toHaveBeenCalledWith('检测到微信开发者工具服务端口当前处于关闭状态，已保留用户设置并回退到普通 open 流程。')
    expect(launchAutomatorMock).not.toHaveBeenCalled()
    expect(parseMock).toHaveBeenCalledWith([
      'open',
      '-p',
      'dist/dev/mp-weixin',
      '--trust-project',
    ])
  })

  it('prints original automator error when fallback debug env is enabled', async () => {
    process.env.WEAPP_VITE_DEBUG_AUTOMATOR_OPEN = '1'
    const { openIde } = await import('./openIde')
    const error = new Error('automator failed')
    launchAutomatorMock.mockRejectedValueOnce(error)

    try {
      await openIde('weapp', 'dist/dev/mp-weixin')
    }
    finally {
      delete process.env.WEAPP_VITE_DEBUG_AUTOMATOR_OPEN
    }

    expect(loggerMock.error).toHaveBeenCalledWith(error)
    expect(parseMock).toHaveBeenCalledWith([
      'open',
      '-p',
      'dist/dev/mp-weixin',
      '--trust-project',
    ])
  })

  it('reminds user when devtools login is invalid before falling back from automator open', async () => {
    const { openIde } = await import('./openIde')
    const error = new Error('需要重新登录 (code 10)')
    launchAutomatorMock.mockRejectedValueOnce(error)
    isAutomatorLoginErrorMock.mockReturnValueOnce(true)

    await openIde('weapp', 'dist/dev/mp-weixin')

    expect(loggerMock.error).toHaveBeenCalledWith('检测到微信开发者工具登录状态失效，请先登录后重试。')
    expect(loggerMock.warn).toHaveBeenCalledWith('微信开发者工具返回登录错误：\n- code: 10\n- message: 需要重新登录')
    expect(parseMock).toHaveBeenCalledWith([
      'open',
      '-p',
      'dist/dev/mp-weixin',
      '--trust-project',
    ])
  })

  it('logs and continues when devtools settings bootstrap fails', async () => {
    const { openIde } = await import('./openIde')
    const error = new Error('bootstrap failed')
    bootstrapWechatDevtoolsSettingsMock.mockRejectedValueOnce(error)

    await openIde('weapp', 'dist/dev/mp-weixin', { trustProject: false })

    expect(loggerMock.warn).toHaveBeenCalledWith('检测微信开发者工具服务端口或写入项目信任状态失败，继续执行 open 流程。')
    expect(loggerMock.error).toHaveBeenCalledWith(error)
    expect(parseMock).toHaveBeenCalledWith([
      'open',
      '-p',
      'dist/dev/mp-weixin',
    ])
  })

  it('passes close command to weapp-ide-cli helper', async () => {
    const { closeIde } = await import('./openIde')
    await closeIde()

    expect(closeWechatIdeProjectMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to AppleScript when close command fails on macOS', async () => {
    const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    closeWechatIdeProjectMock.mockRejectedValueOnce(new Error('close failed'))

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
    closeWechatIdeProjectMock.mockRejectedValueOnce(new Error('close failed'))
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

  it('returns false when close command and all fallback closers fail', async () => {
    const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')
    Object.defineProperty(process, 'platform', { value: 'linux' })
    closeWechatIdeProjectMock.mockRejectedValueOnce(new Error('close failed'))
    execFileMock.mockImplementation((_file: string, _args: string[], callback: (error: any) => void) => {
      callback(new Error('pkill failed'))
      return {} as any
    })

    try {
      const { closeIde } = await import('./openIde')
      const result = await closeIde()

      expect(result).toBe(false)
      expect(execFileMock).toHaveBeenCalledWith(
        'pkill',
        ['-f', '/Applications/wechatwebdevtools.app'],
        expect.any(Function),
      )
    }
    finally {
      if (platformDescriptor) {
        Object.defineProperty(process, 'platform', platformDescriptor)
      }
    }
  })

  it('logs retry failure when close command hits login-required path twice', async () => {
    const loginRequiredError = new Error('login required')
    closeWechatIdeProjectMock.mockRejectedValueOnce(loginRequiredError)
    isWechatIdeLoginRequiredErrorMock.mockReturnValue(true)

    const { closeIde } = await import('./openIde')
    const result = await closeIde()

    expect(result).toBe(true)
    expect(closeWechatIdeProjectMock).toHaveBeenCalledTimes(2)
    expect(parseMock).not.toHaveBeenCalled()
  })

  it('returns false when close fallback has no cli path to kill process', async () => {
    const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')
    Object.defineProperty(process, 'platform', { value: 'linux' })
    closeWechatIdeProjectMock.mockRejectedValueOnce(new Error('close failed'))
    getConfigMock.mockResolvedValueOnce({
      cliPath: '   ',
    })

    try {
      const { closeIde } = await import('./openIde')
      const result = await closeIde()

      expect(result).toBe(false)
      expect(execFileMock).not.toHaveBeenCalled()
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
    promptWechatIdeLoginRetryMock.mockResolvedValue('retry')

    await openIde('weapp', 'dist/dev/mp-weixin', { trustProject: false })

    expect(parseMock).toHaveBeenCalledTimes(2)
    expect(promptWechatIdeLoginRetryMock).toHaveBeenCalledTimes(1)
    expect(promptWechatIdeLoginRetryMock).toHaveBeenCalledWith({
      cancelLevel: 'warn',
      error: loginRequiredError,
      logger: loggerMock,
    })
    expect(loggerMock.info).toHaveBeenCalledWith('正在重试连接微信开发者工具...')
  })

  it('stops retry loop when login is required and user cancels', async () => {
    const { openIde } = await import('./openIde')
    const loginRequiredError = new Error('需要重新登录 (code 10)')

    parseMock.mockRejectedValueOnce(loginRequiredError)
    isWechatIdeLoginRequiredErrorMock.mockReturnValue(true)
    promptWechatIdeLoginRetryMock.mockResolvedValue('cancel')

    await expect(openIde('weapp', 'dist/dev/mp-weixin', { trustProject: false })).rejects.toThrow('cancelled')

    expect(parseMock).toHaveBeenCalledTimes(1)
    expect(promptWechatIdeLoginRetryMock).toHaveBeenCalledTimes(1)
    expect(promptWechatIdeLoginRetryMock).toHaveBeenCalledWith({
      cancelLevel: 'warn',
      error: loginRequiredError,
      logger: loggerMock,
    })
  })

  it('prints original error for non-login failures', async () => {
    const { openIde } = await import('./openIde')
    const error = new Error('unexpected execution failure')

    parseMock.mockRejectedValueOnce(error)
    isWechatIdeLoginRequiredErrorMock.mockReturnValue(false)

    await openIde('weapp', 'dist/dev/mp-weixin', { trustProject: false })

    expect(loggerMock.error).toHaveBeenCalledWith(error)
    expect(promptWechatIdeLoginRetryMock).not.toHaveBeenCalled()
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
      cwd: '/workspace/project',
      platform: 'alipay',
      projectPath: 'dist/alipay',
    })
  })

  it('resolves ide command context from compiler context when config loading succeeds', async () => {
    createCompilerContextMock.mockResolvedValueOnce({
      configService: {
        platform: 'weapp',
        cwd: '/workspace/project',
        mpDistRoot: '/workspace/project/dist/weapp/dist',
        weappViteConfig: {
          mcp: { enabled: true },
        },
      },
    })

    const { resolveIdeCommandContext } = await import('./openIde')

    const result = await resolveIdeCommandContext({
      cwd: '/workspace/project',
      mode: 'production',
      cliPlatform: 'weapp',
    })

    expect(createInlineConfigMock).toHaveBeenCalledWith(undefined)
    expect(createCompilerContextMock).toHaveBeenCalledWith({
      cwd: '/workspace/project',
      mode: 'production',
      configFile: undefined,
      inlineConfig: { platform: undefined },
      cliPlatform: 'weapp',
    })
    expect(result).toEqual({
      cwd: '/workspace/project',
      platform: 'weapp',
      projectPath: '/workspace/project/dist/weapp',
      weappViteConfig: {
        mcp: { enabled: true },
      },
      mpDistRoot: '/workspace/project/dist/weapp/dist',
    })
  })
})
