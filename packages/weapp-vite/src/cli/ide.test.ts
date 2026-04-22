import { beforeEach, describe, expect, it, vi } from 'vitest'

const isWeappIdeTopLevelCommandMock = vi.hoisted(() => vi.fn())
const executeWechatIdeCliCommandMock = vi.hoisted(() => vi.fn())

vi.mock('weapp-ide-cli', () => ({
  isWeappIdeTopLevelCommand: isWeappIdeTopLevelCommandMock,
}))

vi.mock('./openIde/execute', () => ({
  executeWechatIdeCliCommand: executeWechatIdeCliCommandMock,
}))

describe('tryRunIdeCommand', () => {
  beforeEach(() => {
    isWeappIdeTopLevelCommandMock.mockReset()
    executeWechatIdeCliCommandMock.mockReset()
    executeWechatIdeCliCommandMock.mockResolvedValue(undefined)
    isWeappIdeTopLevelCommandMock.mockImplementation((command: string) =>
      ['cache', 'preview', 'navigate', 'config', 'screenshot', 'compare'].includes(
        command,
      ),
    )
  })

  it('forwards ide-only command to weapp-ide-cli', async () => {
    const { tryRunIdeCommand } = await import('./ide')

    const forwarded = await tryRunIdeCommand([
      'preview',
      '--project',
      '/tmp/demo',
    ])

    expect(forwarded).toBe(true)
    expect(executeWechatIdeCliCommandMock).toHaveBeenCalledWith([
      'preview',
      '--project',
      '/tmp/demo',
    ])
  })

  it('forwards cache command to weapp-ide-cli', async () => {
    const { tryRunIdeCommand } = await import('./ide')

    const forwarded = await tryRunIdeCommand(['cache', '--clean', 'all'])

    expect(forwarded).toBe(true)
    expect(executeWechatIdeCliCommandMock).toHaveBeenCalledWith([
      'cache',
      '--clean',
      'all',
    ])
  })

  it('forwards automator command to weapp-ide-cli', async () => {
    const { tryRunIdeCommand } = await import('./ide')

    const forwarded = await tryRunIdeCommand(['navigate', 'pages/index/index'])

    expect(forwarded).toBe(true)
    expect(executeWechatIdeCliCommandMock).toHaveBeenCalledWith([
      'navigate',
      'pages/index/index',
    ])
  })

  it('forwards compare command to weapp-ide-cli', async () => {
    const { tryRunIdeCommand } = await import('./ide')

    const forwarded = await tryRunIdeCommand(['compare', '--baseline', 'baseline.png'])

    expect(forwarded).toBe(true)
    expect(executeWechatIdeCliCommandMock).toHaveBeenCalledWith(['compare', '--baseline', 'baseline.png'])
  })

  it('forwards help target for ide command', async () => {
    const { tryRunIdeCommand } = await import('./ide')

    const forwarded = await tryRunIdeCommand(['help', 'navigate'])

    expect(forwarded).toBe(true)
    expect(executeWechatIdeCliCommandMock).toHaveBeenCalledWith(['help', 'navigate'])
  })

  it('keeps native help target untouched', async () => {
    const { tryRunIdeCommand } = await import('./ide')

    const forwarded = await tryRunIdeCommand(['help', 'open'])

    expect(forwarded).toBe(false)
    expect(executeWechatIdeCliCommandMock).not.toHaveBeenCalled()
  })

  it('forwards namespaced ide command', async () => {
    const { tryRunIdeCommand } = await import('./ide')

    const forwarded = await tryRunIdeCommand(['ide', 'config', 'lang', 'en'])

    expect(forwarded).toBe(true)
    expect(executeWechatIdeCliCommandMock).toHaveBeenCalledWith(['config', 'lang', 'en'])
  })

  it('keeps native ide logs command untouched', async () => {
    const { tryRunIdeCommand } = await import('./ide')

    const forwarded = await tryRunIdeCommand(['ide', 'logs'])

    expect(forwarded).toBe(false)
    expect(executeWechatIdeCliCommandMock).not.toHaveBeenCalled()
  })

  it('keeps native weapp-vite open command untouched', async () => {
    const { tryRunIdeCommand } = await import('./ide')

    const forwarded = await tryRunIdeCommand(['open'])

    expect(forwarded).toBe(false)
    expect(executeWechatIdeCliCommandMock).not.toHaveBeenCalled()
  })

  it('does not forward weapp-vite build command', async () => {
    const { tryRunIdeCommand } = await import('./ide')

    const forwarded = await tryRunIdeCommand(['build'])

    expect(forwarded).toBe(false)
    expect(executeWechatIdeCliCommandMock).not.toHaveBeenCalled()
  })

  it('does not forward weapp-vite mcp command', async () => {
    const { tryRunIdeCommand } = await import('./ide')

    const forwarded = await tryRunIdeCommand(['mcp'])

    expect(forwarded).toBe(false)
    expect(executeWechatIdeCliCommandMock).not.toHaveBeenCalled()
  })

  it('forwards unknown command to weapp-ide-cli', async () => {
    const { tryRunIdeCommand } = await import('./ide')

    const forwarded = await tryRunIdeCommand(['foobar', '--x'])

    expect(forwarded).toBe(false)
    expect(executeWechatIdeCliCommandMock).not.toHaveBeenCalled()
  })
})
