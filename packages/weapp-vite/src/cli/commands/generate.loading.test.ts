import { cac } from 'cac'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const generateMock = vi.hoisted(() => vi.fn())
const schematicsLoadedMock = vi.hoisted(() => vi.fn())
const loadConfigMock = vi.hoisted(() => vi.fn())
const loggerErrorMock = vi.hoisted(() => vi.fn())

vi.mock('../loadConfig', () => ({ loadConfig: loadConfigMock }))
vi.mock('../../logger', () => ({ default: { error: loggerErrorMock } }))

async function createCli() {
  const { registerGenerateCommand } = await import('./generate')
  const cli = cac('weapp-vite')
  cli.option('-c, --config <config>', '配置文件').help()
  registerGenerateCommand(cli)
  return cli
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  generateMock.mockReset().mockResolvedValue(undefined)
  loadConfigMock.mockReset().mockResolvedValue(undefined)
  vi.doMock('../../schematics', () => {
    schematicsLoadedMock()
    return { generate: generateMock }
  })
})

afterEach(() => {
  vi.doUnmock('../../schematics')
  vi.restoreAllMocks()
})

describe('generate command dependency loading', () => {
  it('registers and prints command help without loading the generator or config', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {})
    const cli = await createCli()
    expect(schematicsLoadedMock).not.toHaveBeenCalled()

    cli.parse(['node', 'weapp-vite', 'generate', '--help'])

    expect(log).toHaveBeenCalled()
    expect(schematicsLoadedMock).not.toHaveBeenCalled()
    expect(loadConfigMock).not.toHaveBeenCalled()
    expect(generateMock).not.toHaveBeenCalled()
  })

  it('loads the generator for the alias action and preserves explicit filenames and config', async () => {
    const cli = await createCli()
    cli.parse(['node', 'weapp-vite', 'generate', 'components/card', '-n', 'card-view', '-c', 'custom.config.ts'], { run: false })
    expect(schematicsLoadedMock).not.toHaveBeenCalled()

    await cli.runMatchedCommand()

    expect(loadConfigMock).toHaveBeenCalledExactlyOnceWith('custom.config.ts')
    expect(schematicsLoadedMock).toHaveBeenCalledTimes(1)
    expect(generateMock).toHaveBeenCalledExactlyOnceWith({
      outDir: 'components/card',
      type: 'component',
      fileName: 'card-view',
      extensions: undefined,
      templates: undefined,
    })
  })

  it('preserves configured directories, filenames, extensions and templates', async () => {
    const extensions = { js: 'ts', wxml: 'axml' }
    const templates = { component: { js: { content: 'Component({})' } } }
    loadConfigMock.mockResolvedValue({
      config: {
        weapp: {
          generate: {
            dirs: { component: 'generated/components' },
            filenames: { component: 'configured-card' },
            extensions,
            templates,
          },
        },
      },
    })
    const cli = await createCli()
    cli.parse(['node', 'weapp-vite', 'g', 'card', '--name', 'cli-card', '--config', 'first.config.ts', '--config', 'last.config.ts'], { run: false })

    await cli.runMatchedCommand()

    expect(loadConfigMock).toHaveBeenCalledExactlyOnceWith('last.config.ts')
    expect(generateMock).toHaveBeenCalledExactlyOnceWith({
      outDir: 'generated/components/card',
      type: 'component',
      fileName: 'configured-card',
      extensions,
      templates,
    })
  })

  it.each([
    { args: ['--app'], outDir: '.', type: 'app', fileName: 'app' },
    { args: ['pages/detail', '--page', '--name', 'detail'], outDir: 'pages/detail', type: 'page', fileName: 'detail' },
    { args: ['pages/detail', '--app', '--page'], outDir: 'pages/detail', type: 'page', fileName: 'app' },
  ])('preserves generation options for $args', async ({ args, outDir, type, fileName }) => {
    const cli = await createCli()
    cli.parse(['node', 'weapp-vite', 'g', ...args], { run: false })

    await cli.runMatchedCommand()

    expect(generateMock).toHaveBeenCalledExactlyOnceWith({ outDir, type, fileName, extensions: undefined, templates: undefined })
    expect(schematicsLoadedMock).toHaveBeenCalledTimes(1)
  })

  it('reports a missing path without loading the generator', async () => {
    const cli = await createCli()
    cli.parse(['node', 'weapp-vite', 'g'], { run: false })

    await cli.runMatchedCommand()

    expect(loggerErrorMock).toHaveBeenCalledExactlyOnceWith('weapp-vite generate <outDir> 命令必须传入路径参数 outDir')
    expect(schematicsLoadedMock).not.toHaveBeenCalled()
    expect(generateMock).not.toHaveBeenCalled()
  })

  it('preserves a config failure without loading the generator', async () => {
    const error = new Error('invalid config')
    loadConfigMock.mockRejectedValue(error)
    const cli = await createCli()
    cli.parse(['node', 'weapp-vite', 'g', 'components/card'], { run: false })

    await expect(cli.runMatchedCommand()).rejects.toBe(error)

    expect(schematicsLoadedMock).not.toHaveBeenCalled()
    expect(generateMock).not.toHaveBeenCalled()
  })

  it('awaits the generator and propagates its failure', async () => {
    const error = new Error('generation failed')
    generateMock.mockRejectedValue(error)
    const cli = await createCli()
    cli.parse(['node', 'weapp-vite', 'g', 'components/card'], { run: false })

    await expect(cli.runMatchedCommand()).rejects.toBe(error)

    expect(generateMock).toHaveBeenCalledTimes(1)
    expect(loggerErrorMock).not.toHaveBeenCalled()
  })
})
