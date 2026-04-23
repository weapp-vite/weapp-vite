import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const openIdeMock = vi.hoisted(() => vi.fn())
const resolveIdeCommandContextMock = vi.hoisted(() => vi.fn())
const resolveForwardConsoleOptionsMock = vi.hoisted(() => vi.fn())
const startForwardConsoleBridgeMock = vi.hoisted(() => vi.fn())
const readLatestHmrProfileSummaryMock = vi.hoisted(() => vi.fn())
const bootstrapWechatDevtoolsSettingsMock = vi.hoisted(() => vi.fn())
const getWechatIdeTestAccountsMock = vi.hoisted(() => vi.fn())
const getWechatIdeTicketMock = vi.hoisted(() => vi.fn())
const getWechatIdeToolInfoMock = vi.hoisted(() => vi.fn())
const refreshWechatIdeTicketMock = vi.hoisted(() => vi.fn())
const setWechatIdeTicketMock = vi.hoisted(() => vi.fn())
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
  getWechatIdeTestAccounts: getWechatIdeTestAccountsMock,
  getWechatIdeTicket: getWechatIdeTicketMock,
  getWechatIdeToolInfo: getWechatIdeToolInfoMock,
  refreshWechatIdeTicket: refreshWechatIdeTicketMock,
  setWechatIdeTicket: setWechatIdeTicketMock,
}))

vi.mock('../forwardConsole', () => ({
  resolveForwardConsoleOptions: resolveForwardConsoleOptionsMock,
  startForwardConsoleBridge: startForwardConsoleBridgeMock,
}))

vi.mock('../hmrProfileSummary', () => ({
  readLatestHmrProfileSummary: readLatestHmrProfileSummaryMock,
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
    readLatestHmrProfileSummaryMock.mockReset()
    bootstrapWechatDevtoolsSettingsMock.mockReset()
    getWechatIdeTestAccountsMock.mockReset()
    getWechatIdeTicketMock.mockReset()
    getWechatIdeToolInfoMock.mockReset()
    refreshWechatIdeTicketMock.mockReset()
    setWechatIdeTicketMock.mockReset()
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
      cwd: '/workspace/demo',
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
      detectedSecurityCount: 1,
      updatedSecurityCount: 0,
      trustedProjectCount: 1,
    })
    getWechatIdeTestAccountsMock.mockResolvedValue(['tester-a'])
    getWechatIdeTicketMock.mockResolvedValue({ ticket: 'ticket-a' })
    getWechatIdeToolInfoMock.mockResolvedValue({ SDKVersion: '3.0.0' })
    refreshWechatIdeTicketMock.mockResolvedValue(undefined)
    setWechatIdeTicketMock.mockResolvedValue(undefined)
    startForwardConsoleBridgeMock.mockResolvedValue({
      close: vi.fn().mockResolvedValue(undefined),
    })
    readLatestHmrProfileSummaryMock.mockResolvedValue(undefined)
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
    expect(readLatestHmrProfileSummaryMock).toHaveBeenCalledWith({
      cwd: '/workspace/demo',
      relativeCwd: expect.any(Function),
      weappViteConfig: {},
    })
    expect(processOffSpy).toHaveBeenCalled()
  })

  it('prints latest hmr summary before attaching ide logs bridge', async () => {
    readLatestHmrProfileSummaryMock.mockResolvedValue({
      line: '[hmr] 最近一次热更新 120.00 ms，update，src/pages/logs/index.vue，主耗时 emit 60.00 ms',
      profilePath: '/workspace/demo/.weapp-vite/hmr-profile.jsonl',
    })
    const { runIdeCommand } = await import('./ide')

    await runIdeCommand('logs', undefined, {})

    expect(loggerMock.info).toHaveBeenCalledWith('[hmr] 最近一次热更新 120.00 ms，update，src/pages/logs/index.vue，主耗时 emit 60.00 ms')
    expect(startForwardConsoleBridgeMock).toHaveBeenCalledTimes(1)
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
      cwd: '/workspace/demo',
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
    expect(loggerMock.info).toHaveBeenCalledWith('已完成微信开发者工具配置预热：扫描实例 1 个，检测服务端口配置 1 处，写入项目信任 1 处。')
  })

  it('forwards trust-project override for setup action', async () => {
    const { runIdeCommand } = await import('./ide')

    await runIdeCommand('setup', undefined, { trustProject: false })

    expect(bootstrapWechatDevtoolsSettingsMock).toHaveBeenCalledWith({
      projectPath: 'dist/dev',
      trustProject: false,
    })
  })

  it('prints tool info through opened-session helper', async () => {
    const { runIdeCommand } = await import('./ide')

    await runIdeCommand('info', undefined, {})

    expect(getWechatIdeToolInfoMock).toHaveBeenCalledWith({
      projectPath: 'dist/dev',
    })
    expect(loggerMock.info).toHaveBeenCalledWith(JSON.stringify({ SDKVersion: '3.0.0' }, null, 2))
    expect(startForwardConsoleBridgeMock).not.toHaveBeenCalled()
  })

  it('prints test accounts through opened-session helper', async () => {
    const { runIdeCommand } = await import('./ide')

    await runIdeCommand('test-accounts', undefined, {})

    expect(getWechatIdeTestAccountsMock).toHaveBeenCalledWith({
      projectPath: 'dist/dev',
    })
    expect(loggerMock.info).toHaveBeenCalledWith(JSON.stringify(['tester-a'], null, 2))
  })

  it('prints ticket through opened-session helper', async () => {
    const { runIdeCommand } = await import('./ide')

    await runIdeCommand('ticket', undefined, {})

    expect(getWechatIdeTicketMock).toHaveBeenCalledWith({
      projectPath: 'dist/dev',
    })
    expect(loggerMock.info).toHaveBeenCalledWith(JSON.stringify({ ticket: 'ticket-a' }, null, 2))
  })

  it('sets ticket through opened-session helper', async () => {
    const { runIdeCommand } = await import('./ide')

    await runIdeCommand('ticket:set', undefined, { ticket: 'ticket-b' })

    expect(setWechatIdeTicketMock).toHaveBeenCalledWith({
      projectPath: 'dist/dev',
      ticket: 'ticket-b',
    })
    expect(loggerMock.info).toHaveBeenCalledWith('已设置微信开发者工具 ticket：ticket-b')
  })

  it('rejects ticket:set without --ticket', async () => {
    const { runIdeCommand } = await import('./ide')

    await expect(runIdeCommand('ticket:set', undefined, {})).rejects.toThrow('`weapp-vite ide ticket:set` 需要提供 --ticket。')
    expect(setWechatIdeTicketMock).not.toHaveBeenCalled()
  })

  it('refreshes ticket through opened-session helper', async () => {
    const { runIdeCommand } = await import('./ide')

    await runIdeCommand('ticket:refresh', undefined, {})

    expect(refreshWechatIdeTicketMock).toHaveBeenCalledWith({
      projectPath: 'dist/dev',
    })
    expect(loggerMock.info).toHaveBeenCalledWith('已刷新微信开发者工具 ticket。')
  })
})
