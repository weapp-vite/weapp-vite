import { cac } from 'cac'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const initConfigMock = vi.hoisted(() => vi.fn())
const initLoadedMock = vi.hoisted(() => vi.fn())
const loggerErrorMock = vi.hoisted(() => vi.fn())

vi.mock('../../logger', () => ({ default: { error: loggerErrorMock } }))

async function createCli() {
  const { registerInitCommand } = await import('./init')
  const cli = cac('weapp-vite')
  cli.help()
  registerInitCommand(cli)
  return cli
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  initConfigMock.mockReset().mockResolvedValue(undefined)
  vi.doMock('@weapp-core/init', () => {
    initLoadedMock()
    return { initConfig: initConfigMock }
  })
})

afterEach(() => {
  vi.doUnmock('@weapp-core/init')
  vi.restoreAllMocks()
})

describe('init command dependency loading', () => {
  it('registers and prints command help without loading initialization dependencies', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {})
    const cli = await createCli()
    expect(initLoadedMock).not.toHaveBeenCalled()

    cli.parse(['node', 'weapp-vite', 'init', '--help'])

    expect(log).toHaveBeenCalled()
    expect(initLoadedMock).not.toHaveBeenCalled()
    expect(initConfigMock).not.toHaveBeenCalled()
  })

  it('loads initialization dependencies only for the matched action with the original command', async () => {
    const cli = await createCli()
    cli.parse(['node', 'weapp-vite', 'init'], { run: false })
    expect(initLoadedMock).not.toHaveBeenCalled()

    await cli.runMatchedCommand()

    expect(initLoadedMock).toHaveBeenCalledTimes(1)
    expect(initConfigMock).toHaveBeenCalledExactlyOnceWith({ command: 'weapp-vite' })
    expect(loggerErrorMock).not.toHaveBeenCalled()
  })

  it('logs an initialization failure and still resolves the action', async () => {
    const error = new Error('initialization failed')
    initConfigMock.mockRejectedValue(error)
    const cli = await createCli()
    cli.parse(['node', 'weapp-vite', 'init'], { run: false })

    await expect(cli.runMatchedCommand()).resolves.toBeUndefined()

    expect(initConfigMock).toHaveBeenCalledTimes(1)
    expect(loggerErrorMock).toHaveBeenCalledExactlyOnceWith(error)
  })

  it('logs a dependency loading failure without invoking initialization', async () => {
    const error = new Error('initialization dependency unavailable')
    vi.doMock('@weapp-core/init', () => {
      throw error
    })
    const cli = await createCli()
    cli.parse(['node', 'weapp-vite', 'init'], { run: false })

    await expect(cli.runMatchedCommand()).resolves.toBeUndefined()

    expect(initConfigMock).not.toHaveBeenCalled()
    expect(loggerErrorMock).toHaveBeenCalledTimes(1)
    expect(loggerErrorMock.mock.calls[0]?.[0]).toBeInstanceOf(Error)
  })
})
