import { beforeEach, describe, expect, it, vi } from 'vitest'

const parseWeappIdeCliMock = vi.hoisted(() => vi.fn())

vi.mock('weapp-ide-cli', () => ({
  parse: parseWeappIdeCliMock,
}))

describe('tryRunIdeCommand', () => {
  beforeEach(() => {
    parseWeappIdeCliMock.mockReset()
    parseWeappIdeCliMock.mockResolvedValue(undefined)
  })

  it('forwards ide-only command to weapp-ide-cli', async () => {
    const { tryRunIdeCommand } = await import('./ide')

    const forwarded = await tryRunIdeCommand(['preview', '--project', '/tmp/demo'])

    expect(forwarded).toBe(true)
    expect(parseWeappIdeCliMock).toHaveBeenCalledWith(['preview', '--project', '/tmp/demo'])
  })

  it('forwards automator command to weapp-ide-cli', async () => {
    const { tryRunIdeCommand } = await import('./ide')

    const forwarded = await tryRunIdeCommand(['navigate', 'pages/index/index'])

    expect(forwarded).toBe(true)
    expect(parseWeappIdeCliMock).toHaveBeenCalledWith(['navigate', 'pages/index/index'])
  })

  it('forwards help target for ide command', async () => {
    const { tryRunIdeCommand } = await import('./ide')

    const forwarded = await tryRunIdeCommand(['help', 'navigate'])

    expect(forwarded).toBe(true)
    expect(parseWeappIdeCliMock).toHaveBeenCalledWith(['help', 'navigate'])
  })

  it('keeps native help target untouched', async () => {
    const { tryRunIdeCommand } = await import('./ide')

    const forwarded = await tryRunIdeCommand(['help', 'open'])

    expect(forwarded).toBe(false)
    expect(parseWeappIdeCliMock).not.toHaveBeenCalled()
  })

  it('forwards namespaced ide command', async () => {
    const { tryRunIdeCommand } = await import('./ide')

    const forwarded = await tryRunIdeCommand(['ide', 'config', 'lang', 'en'])

    expect(forwarded).toBe(true)
    expect(parseWeappIdeCliMock).toHaveBeenCalledWith(['config', 'lang', 'en'])
  })

  it('keeps native weapp-vite open command untouched', async () => {
    const { tryRunIdeCommand } = await import('./ide')

    const forwarded = await tryRunIdeCommand(['open'])

    expect(forwarded).toBe(false)
    expect(parseWeappIdeCliMock).not.toHaveBeenCalled()
  })

  it('does not forward weapp-vite build command', async () => {
    const { tryRunIdeCommand } = await import('./ide')

    const forwarded = await tryRunIdeCommand(['build'])

    expect(forwarded).toBe(false)
    expect(parseWeappIdeCliMock).not.toHaveBeenCalled()
  })

  it('forwards unknown command to weapp-ide-cli', async () => {
    const { tryRunIdeCommand } = await import('./ide')

    const forwarded = await tryRunIdeCommand(['foobar', '--x'])

    expect(forwarded).toBe(true)
    expect(parseWeappIdeCliMock).toHaveBeenCalledWith(['foobar', '--x'])
  })
})
