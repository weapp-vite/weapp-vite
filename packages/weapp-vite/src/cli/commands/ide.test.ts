import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const openIdeMock = vi.hoisted(() => vi.fn())
const resolveIdeCommandContextMock = vi.hoisted(() => vi.fn())
const resolveForwardConsoleOptionsMock = vi.hoisted(() => vi.fn())
const startForwardConsoleBridgeMock = vi.hoisted(() => vi.fn())
const bootstrapWechatDevtoolsSettingsMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
}))

vi.mock('../openIde', () => ({
  openIde: openIdeMock,
  resolveIdeCommandContext: resolveIdeCommandContextMock,
}))

vi.mock('weapp-ide-cli', () => ({
  bootstrapWechatDevtoolsSettings: bootstrapWechatDevtoolsSettingsMock,
}))

vi.mock('../forwardConsole', () => ({
  resolveForwardConsoleOptions: resolveForwardConsoleOptionsMock,
  startForwardConsoleBridge: startForwardConsoleBridgeMock,
}))

vi.mock('../../logger', () => ({
  default: loggerMock,
}))

describe('ide logs command', () => {
  let autoTerminate = true
  let processOnSpy: ReturnType<typeof vi.spyOn>
  let processOffSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    autoTerminate = true
    openIdeMock.mockReset()
    resolveIdeCommandContextMock.mockReset()
    resolveForwardConsoleOptionsMock.mockReset()
    startForwardConsoleBridgeMock.mockReset()
    bootstrapWechatDevtoolsSettingsMock.mockReset()
    loggerMock.info.mockReset()
    loggerMock.warn.mockReset()
    loggerMock.error.mockReset()
    loggerMock.log.mockReset()

    processOnSpy = vi.spyOn(process, 'on').mockImplementation(((event: string, handler: () => void) => {
      if (event === 'SIGINT' && autoTerminate) {
        queueMicrotask(() => {
          handler()
        })
      }
      return process
    }) as any)
    processOffSpy = vi.spyOn(process, 'off').mockImplementation((() => {
      return process
    }) as any)

    openIdeMock.mockResolvedValue(undefined)
    resolveIdeCommandContextMock.mockResolvedValue({
      platform: 'weapp',
      projectPath: 'dist/dev',
      weappViteConfig: {},
    })
    resolveForwardConsoleOptionsMock.mockResolvedValue({
      enabled: true,
      logLevels: ['log', 'info', 'warn', 'error'],
      unhandledErrors: true,
    })
    bootstrapWechatDevtoolsSettingsMock.mockResolvedValue({
      touchedInstanceCount: 1,
      updatedSecurityCount: 1,
      trustedProjectCount: 1,
    })
    startForwardConsoleBridgeMock.mockResolvedValue({
      close: vi.fn().mockResolvedValue(undefined),
    })
  })

  afterEach(() => {
    processOnSpy.mockRestore()
    processOffSpy.mockRestore()
  })

  it('starts ide logs bridge and waits for signals', async () => {
    const { runIdeCommand } = await import('./ide')

    await runIdeCommand('logs', undefined, {})

    expect(startForwardConsoleBridgeMock).toHaveBeenCalledWith(expect.objectContaining({
      projectPath: 'dist/dev',
      logLevels: ['log', 'info', 'warn', 'error'],
      unhandledErrors: true,
    }))
    expect(processOffSpy).toHaveBeenCalled()
  })

  it('opens ide first when --open is provided', async () => {
    const { runIdeCommand } = await import('./ide')

    await runIdeCommand('logs', undefined, { open: true })

    expect(openIdeMock).toHaveBeenCalledWith('weapp', 'dist/dev', {
      trustProject: undefined,
    })
  })

  it('forwards trust-project override when opening ide logs bridge', async () => {
    const { runIdeCommand } = await import('./ide')

    await runIdeCommand('logs', undefined, { open: true, trustProject: false })

    expect(openIdeMock).toHaveBeenCalledWith('weapp', 'dist/dev', {
      trustProject: false,
    })
  })

  it('rejects non-weapp platforms', async () => {
    resolveIdeCommandContextMock.mockResolvedValue({
      platform: 'alipay',
      projectPath: 'dist/alipay',
      weappViteConfig: {},
    })
    const { runIdeCommand } = await import('./ide')

    await expect(runIdeCommand('logs', undefined, {})).rejects.toThrow('`weapp-vite ide logs` 当前仅支持微信小程序平台。')
  })

  it('bootstraps devtools settings without opening ide for setup action', async () => {
    const { runIdeCommand } = await import('./ide')

    await runIdeCommand('setup', undefined, {})

    expect(bootstrapWechatDevtoolsSettingsMock).toHaveBeenCalledWith({
      projectPath: 'dist/dev',
      trustProject: undefined,
    })
    expect(startForwardConsoleBridgeMock).not.toHaveBeenCalled()
    expect(openIdeMock).not.toHaveBeenCalled()
    expect(loggerMock.info).toHaveBeenCalledWith('已完成微信开发者工具配置预热：扫描实例 1 个，更新安全设置 1 处，写入项目信任 1 处。')
  })

  it('forwards trust-project override for setup action', async () => {
    const { runIdeCommand } = await import('./ide')

    await runIdeCommand('setup', undefined, { trustProject: false })

    expect(bootstrapWechatDevtoolsSettingsMock).toHaveBeenCalledWith({
      projectPath: 'dist/dev',
      trustProject: false,
    })
  })
})
