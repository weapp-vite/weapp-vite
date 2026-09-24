import { beforeEach, describe, expect, it, vi } from 'vitest'

const dispatchWechatCliCommandMock = vi.hoisted(() => vi.fn())
const isWeappIdeTopLevelCommandMock = vi.hoisted(() => vi.fn())
const executeWechatIdeCliCommandMock = vi.hoisted(() => vi.fn())

vi.mock('weapp-ide-cli', () => ({
  dispatchWechatCliCommand: dispatchWechatCliCommandMock,
  isWeappIdeTopLevelCommand: isWeappIdeTopLevelCommandMock,
}))

vi.mock('./openIde/execute', () => ({
  executeWechatIdeCliCommand: executeWechatIdeCliCommandMock,
}))

describe('tryRunIdeCommand', () => {
  beforeEach(() => {
    dispatchWechatCliCommandMock.mockReset()
    isWeappIdeTopLevelCommandMock.mockReset()
    executeWechatIdeCliCommandMock.mockReset()
    dispatchWechatCliCommandMock.mockResolvedValue(false)
    executeWechatIdeCliCommandMock.mockResolvedValue(undefined)
    isWeappIdeTopLevelCommandMock.mockImplementation((command: string) =>
      ['cache', 'preview', 'upload', 'navigate', 'config', 'screenshot', 'compare'].includes(
        command,
      ),
    )
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

  it('prefers helper dispatch for namespaced ide command before execute fallback', async () => {
    const { tryRunIdeCommand } = await import('./ide')
    dispatchWechatCliCommandMock.mockResolvedValueOnce(true)

    const forwarded = await tryRunIdeCommand(['ide', 'cache', '--clean', 'all'])

    expect(forwarded).toBe(true)
    expect(dispatchWechatCliCommandMock).toHaveBeenCalledWith(['cache', '--clean', 'all'])
    expect(executeWechatIdeCliCommandMock).not.toHaveBeenCalled()
  })

  it('keeps native ide logs command untouched', async () => {
    const { tryRunIdeCommand } = await import('./ide')

    const forwarded = await tryRunIdeCommand(['ide', 'logs'])

    expect(forwarded).toBe(false)
    expect(executeWechatIdeCliCommandMock).not.toHaveBeenCalled()
  })

  it('keeps native ide doctor command untouched', async () => {
    const { tryRunIdeCommand } = await import('./ide')

    const forwarded = await tryRunIdeCommand(['ide', 'doctor', '--json'])

    expect(forwarded).toBe(false)
    expect(executeWechatIdeCliCommandMock).not.toHaveBeenCalled()
  })

  it('keeps native ide help untouched', async () => {
    const { tryRunIdeCommand } = await import('./ide')

    const forwarded = await tryRunIdeCommand(['ide', '--help'])

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

  it.each(['upload', 'preview'])('keeps %s native but preserves its explicit IDE entry', async (command) => {
    const { tryRunIdeCommand } = await import('./ide')

    expect(await tryRunIdeCommand([command, '--platform', 'jd'])).toBe(false)
    expect(await tryRunIdeCommand(['help', command])).toBe(false)
    expect(executeWechatIdeCliCommandMock).not.toHaveBeenCalled()

    expect(await tryRunIdeCommand(['ide', command, '--project', './dist'])).toBe(true)
    expect(executeWechatIdeCliCommandMock).toHaveBeenCalledWith([command, '--project', './dist'])
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
