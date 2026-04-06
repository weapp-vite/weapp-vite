import { beforeEach, describe, expect, it, vi } from 'vitest'

const loadConfigMock = vi.hoisted(() => vi.fn())
const startWeappViteMcpServerMock = vi.hoisted(() => vi.fn())
const loggerInfoMock = vi.hoisted(() => vi.fn())
const loggerWarnMock = vi.hoisted(() => vi.fn())
const loggerSuccessMock = vi.hoisted(() => vi.fn())

vi.mock('./loadConfig', () => ({
  loadConfig: loadConfigMock,
}))

vi.mock('../logger', () => ({
  default: {
    info: loggerInfoMock,
    warn: loggerWarnMock,
    success: loggerSuccessMock,
  },
  colors: {
    cyan: (value: string) => value,
  },
}))

vi.mock('../mcp', () => ({
  resolveWeappMcpConfig: vi.fn((input: any) => {
    if (input === false) {
      return {
        autoStart: false,
        enabled: false,
        endpoint: '/mcp',
        host: '127.0.0.1',
        port: 3088,
      }
    }
    return {
      autoStart: true,
      enabled: true,
      endpoint: '/mcp',
      host: '127.0.0.1',
      port: 3088,
    }
  }),
  startWeappViteMcpServer: startWeappViteMcpServerMock,
}))

describe('mcp auto start', () => {
  beforeEach(async () => {
    loadConfigMock.mockReset()
    startWeappViteMcpServerMock.mockReset()
    loggerInfoMock.mockReset()
    loggerWarnMock.mockReset()
    loggerSuccessMock.mockReset()
    loadConfigMock.mockResolvedValue(undefined)
    startWeappViteMcpServerMock.mockResolvedValue(undefined)
    const mod = await import('./mcpAutoStart')
    mod.__resetAutoStartMcpStateForTest()
  })

  it('does not auto start for dev command because dev hotkeys manage mcp lifecycle', async () => {
    const { maybeAutoStartMcpServer } = await import('./mcpAutoStart')

    await maybeAutoStartMcpServer(['dev'], {})

    expect(startWeappViteMcpServerMock).not.toHaveBeenCalled()
  })

  it('auto starts streamable-http mcp for native root commands', async () => {
    const { maybeAutoStartMcpServer } = await import('./mcpAutoStart')

    await maybeAutoStartMcpServer(['.'], {})

    expect(startWeappViteMcpServerMock).toHaveBeenCalledWith(expect.objectContaining({
      transport: 'streamable-http',
      unref: true,
    }))
    expect(loggerSuccessMock).toHaveBeenCalledWith('MCP 服务已自动启动：')
    expect(loggerInfoMock).toHaveBeenCalledWith('  ➜  http://127.0.0.1:3088/mcp')
  })

  it('does not auto start when mcp is disabled in config', async () => {
    const { maybeAutoStartMcpServer } = await import('./mcpAutoStart')
    loadConfigMock.mockResolvedValue({
      config: {
        weapp: {
          mcp: false,
        },
      },
    })

    await maybeAutoStartMcpServer(['dev'], {})

    expect(startWeappViteMcpServerMock).not.toHaveBeenCalled()
  })

  it('does not auto start for mcp command itself', async () => {
    const { maybeAutoStartMcpServer } = await import('./mcpAutoStart')

    await maybeAutoStartMcpServer(['mcp'], {})

    expect(startWeappViteMcpServerMock).not.toHaveBeenCalled()
  })

  it('does not auto start for build command', async () => {
    const { maybeAutoStartMcpServer } = await import('./mcpAutoStart')

    await maybeAutoStartMcpServer(['build'], {})

    expect(startWeappViteMcpServerMock).not.toHaveBeenCalled()
  })
})
