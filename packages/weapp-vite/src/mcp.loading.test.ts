import { expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runtimeLoaded: vi.fn(),
  ideLoaded: vi.fn(),
  createServer: vi.fn(),
  startServer: vi.fn(),
  connectMiniProgram: vi.fn(),
  resolveSessionOptions: vi.fn(),
  prepareProject: vi.fn(),
}))

vi.mock('@weapp-vite/mcp', () => {
  mocks.runtimeLoaded()
  return {
    createWeappViteMcpServer: mocks.createServer,
    startWeappViteMcpServer: mocks.startServer,
  }
})

vi.mock('weapp-ide-cli', () => {
  mocks.ideLoaded()
  return { resolveAutomatorSessionOptions: mocks.resolveSessionOptions, connectMiniProgram: mocks.connectMiniProgram, prepareAcceptanceProject: mocks.prepareProject }
})

it('keeps synchronous configuration independent of optional servers and loads them only when used', async () => {
  const mcp = await import('./mcp')
  expect(mcp.resolveWeappMcpConfig(false)).toMatchObject({ enabled: false, autoStart: false })
  expect(mcp.resolveWeappMcpConfig(undefined, { env: {} }).endpoint).toBe('/mcp')
  expect(mcp.resolveProjectMcpPort('project')).toBeTypeOf('number')
  expect(mcp.DEFAULT_MCP_HOST).toBe('127.0.0.1')
  expect(mcp.DEFAULT_MCP_PORT).toBe(3088)
  expect(mcp.DEFAULT_RUNTIME_REST_ENDPOINT).toBe('/api/weapp/devtools')
  expect(mocks.runtimeLoaded).not.toHaveBeenCalled()
  expect(mocks.ideLoaded).not.toHaveBeenCalled()

  const server = { close: vi.fn() }
  mocks.createServer.mockResolvedValue(server)
  const options = { workspaceRoot: 'project' }
  await expect(mcp.createWeappViteMcpServer(options)).resolves.toBe(server)
  expect(mocks.runtimeLoaded).toHaveBeenCalledTimes(1)
  expect(mocks.createServer).toHaveBeenCalledExactlyOnceWith(options)
  expect(mocks.ideLoaded).not.toHaveBeenCalled()

  const handle = { transport: 'stdio' }
  mocks.startServer.mockResolvedValue(handle)
  await expect(mcp.startWeappViteMcpServer(options)).resolves.toBe(handle)
  expect(mocks.startServer).toHaveBeenCalledWith(expect.objectContaining({
    workspaceRoot: options.workspaceRoot,
    runtimeHooks: { resolveSessionOptions: mocks.resolveSessionOptions, connectMiniProgram: mocks.connectMiniProgram, prepareProject: mocks.prepareProject },
  }))
  expect(mocks.ideLoaded).toHaveBeenCalledTimes(1)
})
