import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  return {
    createWeappViteMcpServer: vi.fn(),
    startWeappViteMcpServer: vi.fn(async () => ({
      transport: 'stdio' as const,
    })),
  }
})

vi.mock('@weapp-vite/mcp', () => {
  return {
    createWeappViteMcpServer: mocks.createWeappViteMcpServer,
    startWeappViteMcpServer: mocks.startWeappViteMcpServer,
    DEFAULT_MCP_HOST: '127.0.0.1',
    DEFAULT_MCP_PORT: 3088,
    DEFAULT_MCP_ENDPOINT: '/mcp',
  }
})

async function loadMcpModule() {
  return import('./mcp')
}

beforeEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
  mocks.createWeappViteMcpServer.mockReset()
  mocks.startWeappViteMcpServer.mockReset()
  mocks.startWeappViteMcpServer.mockResolvedValue({
    transport: 'stdio',
  })
})

describe('weapp mcp config', () => {
  it('disables mcp when config is false', async () => {
    const { resolveWeappMcpConfig } = await loadMcpModule()
    const resolved = resolveWeappMcpConfig(false)

    expect(resolved.enabled).toBe(false)
    expect(resolved.autoStart).toBe(false)
  })

  it('uses defaults when config is omitted', async () => {
    const { DEFAULT_MCP_ENDPOINT, DEFAULT_MCP_PORT, resolveWeappMcpConfig } = await loadMcpModule()
    const resolved = resolveWeappMcpConfig(undefined)

    expect(resolved.enabled).toBe(true)
    expect(resolved.autoStart).toBe(false)
    expect(resolved.port).toBe(DEFAULT_MCP_PORT)
    expect(resolved.endpoint).toBe(DEFAULT_MCP_ENDPOINT)
  })

  it('normalizes endpoint, host, and port', async () => {
    const { DEFAULT_MCP_PORT, resolveWeappMcpConfig } = await loadMcpModule()
    const resolved = resolveWeappMcpConfig({
      endpoint: ' my-mcp ',
      host: ' 0.0.0.0 ',
      port: -1,
    })

    expect(resolved.endpoint).toBe('/my-mcp')
    expect(resolved.host).toBe('0.0.0.0')
    expect(resolved.port).toBe(DEFAULT_MCP_PORT)
  })

  it('falls back to defaults for empty host and invalid endpoint/port values', async () => {
    const { DEFAULT_MCP_ENDPOINT, DEFAULT_MCP_PORT, resolveWeappMcpConfig } = await loadMcpModule()
    const resolved = resolveWeappMcpConfig({
      endpoint: '   ',
      host: '   ',
      port: 65536,
    })

    expect(resolved.endpoint).toBe(DEFAULT_MCP_ENDPOINT)
    expect(resolved.host).toBe('127.0.0.1')
    expect(resolved.port).toBe(DEFAULT_MCP_PORT)
  })
})

describe('startWeappViteMcpServer', () => {
  it('forwards options to weapp-vite/mcp bridge and injects logger callback', async () => {
    const { default: logger } = await import('./logger')
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {})
    const { startWeappViteMcpServer } = await loadMcpModule()

    const handle = await startWeappViteMcpServer({
      transport: 'streamable-http',
      port: 4090,
    })

    expect(handle).toEqual({
      transport: 'stdio',
    })
    expect(mocks.startWeappViteMcpServer).toHaveBeenCalledTimes(1)

    const forwardedOptions = mocks.startWeappViteMcpServer.mock.calls[0]?.[0]
    expect(forwardedOptions).toMatchObject({
      transport: 'streamable-http',
      port: 4090,
    })

    forwardedOptions?.onReady?.('[mcp] ready')
    expect(infoSpy).toHaveBeenCalledWith('[mcp] ready')
  })

  it('preserves user provided onReady callback', async () => {
    const onReady = vi.fn()
    const { startWeappViteMcpServer } = await loadMcpModule()

    await startWeappViteMcpServer({
      onReady,
    })

    const forwardedOptions = mocks.startWeappViteMcpServer.mock.calls[0]?.[0]
    expect(forwardedOptions?.onReady).toBe(onReady)
  })
})
