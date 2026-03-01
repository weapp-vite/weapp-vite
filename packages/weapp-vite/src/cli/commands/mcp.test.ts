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
      workspaceRoot: './packages/weapp-vite',
    })
  })
})
