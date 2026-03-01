import { cac } from 'cac'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const startWeappViteMcpServerMock = vi.hoisted(() => vi.fn())

vi.mock('../../mcp', () => ({
  startWeappViteMcpServer: startWeappViteMcpServerMock,
}))

describe('mcp cli command', () => {
  beforeEach(() => {
    startWeappViteMcpServerMock.mockReset()
    startWeappViteMcpServerMock.mockResolvedValue(undefined)
  })

  it('starts mcp server with auto workspace root by default', async () => {
    const { registerMcpCommand } = await import('./mcp')
    const cli = cac('weapp-vite')
    registerMcpCommand(cli)

    cli.parse(['node', 'weapp-vite', 'mcp'], { run: false })
    await cli.runMatchedCommand()

    expect(startWeappViteMcpServerMock).toHaveBeenCalledWith({
      endpoint: undefined,
      host: undefined,
      port: undefined,
      transport: 'stdio',
      unref: undefined,
      workspaceRoot: undefined,
    })
  })

  it('starts mcp server with explicit workspace root', async () => {
    const { registerMcpCommand } = await import('./mcp')
    const cli = cac('weapp-vite')
    registerMcpCommand(cli)

    cli.parse(['node', 'weapp-vite', 'mcp', '--workspace-root', './packages/weapp-vite'], { run: false })
    await cli.runMatchedCommand()

    expect(startWeappViteMcpServerMock).toHaveBeenCalledWith({
      endpoint: undefined,
      host: undefined,
      port: undefined,
      transport: 'stdio',
      unref: undefined,
      workspaceRoot: './packages/weapp-vite',
    })
  })

  it('supports streamable-http options', async () => {
    const { registerMcpCommand } = await import('./mcp')
    const cli = cac('weapp-vite')
    registerMcpCommand(cli)

    cli.parse([
      'node',
      'weapp-vite',
      'mcp',
      '--transport',
      'streamable-http',
      '--host',
      '0.0.0.0',
      '--port',
      '3199',
      '--endpoint',
      '/mcp',
    ], { run: false })
    await cli.runMatchedCommand()

    expect(startWeappViteMcpServerMock).toHaveBeenCalledWith({
      endpoint: '/mcp',
      host: '0.0.0.0',
      port: 3199,
      transport: 'streamable-http',
      unref: undefined,
      workspaceRoot: undefined,
    })
  })
})
