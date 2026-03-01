import { beforeEach, describe, expect, it, vi } from 'vitest'

const loadConfigMock = vi.hoisted(() => vi.fn())
const startWeappViteMcpServerMock = vi.hoisted(() => vi.fn())

vi.mock('./loadConfig', () => ({
  loadConfig: loadConfigMock,
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
    loadConfigMock.mockResolvedValue(undefined)
    startWeappViteMcpServerMock.mockResolvedValue(undefined)
    const mod = await import('./mcpAutoStart')
    mod.__resetAutoStartMcpStateForTest()
  })

  it('auto starts streamable-http mcp for native commands', async () => {
    const { maybeAutoStartMcpServer } = await import('./mcpAutoStart')

    await maybeAutoStartMcpServer(['dev'], {})

    expect(startWeappViteMcpServerMock).toHaveBeenCalledWith(expect.objectContaining({
      transport: 'streamable-http',
      unref: true,
    }))
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
})
