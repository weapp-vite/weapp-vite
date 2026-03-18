import { cac } from 'cac'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const createCompilerContextMock = vi.hoisted(() => vi.fn())
const findAutoImportCandidatesMock = vi.hoisted(() => vi.fn())
const shouldBootstrapAutoImportWithoutGlobsMock = vi.hoisted(() => vi.fn())
const getAutoImportConfigMock = vi.hoisted(() => vi.fn())
const loggerInfoMock = vi.hoisted(() => vi.fn())
const loggerWarnMock = vi.hoisted(() => vi.fn())
const filterDuplicateOptionsMock = vi.hoisted(() => vi.fn())
const resolveConfigFileMock = vi.hoisted(() => vi.fn())

vi.mock('../../createContext', () => ({
  createCompilerContext: createCompilerContextMock,
}))

vi.mock('../../plugins/autoImport', () => ({
  findAutoImportCandidates: findAutoImportCandidatesMock,
  shouldBootstrapAutoImportWithoutGlobs: shouldBootstrapAutoImportWithoutGlobsMock,
}))

vi.mock('../../runtime/autoImport/config', () => ({
  getAutoImportConfig: getAutoImportConfigMock,
}))

vi.mock('../../logger', () => ({
  default: {
    info: loggerInfoMock,
    warn: loggerWarnMock,
  },
}))

vi.mock('../options', () => ({
  filterDuplicateOptions: filterDuplicateOptionsMock,
  resolveConfigFile: resolveConfigFileMock,
}))

describe('prepare cli command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveConfigFileMock.mockReturnValue(undefined)
    shouldBootstrapAutoImportWithoutGlobsMock.mockReturnValue(false)
  })

  it('pre-generates auto routes and auto import outputs', async () => {
    const ensureFreshMock = vi.fn().mockResolvedValue(undefined)
    const resetMock = vi.fn()
    const registerPotentialComponentMock = vi.fn().mockResolvedValue(undefined)
    const awaitManifestWritesMock = vi.fn().mockResolvedValue(undefined)

    createCompilerContextMock.mockResolvedValue({
      configService: {
        outDir: 'dist',
      },
      autoRoutesService: {
        isEnabled: () => true,
        ensureFresh: ensureFreshMock,
      },
      autoImportService: {
        reset: resetMock,
        registerPotentialComponent: registerPotentialComponentMock,
        awaitManifestWrites: awaitManifestWritesMock,
      },
    })
    getAutoImportConfigMock.mockReturnValue({
      globs: ['components/**/*'],
    })
    findAutoImportCandidatesMock.mockResolvedValue([
      '/project/src/components/Foo/index.wxml',
      '/project/src/components/Bar/index.wxml',
    ])

    const { registerPrepareCommand } = await import('./prepare')
    const cli = cac('weapp-vite')
    registerPrepareCommand(cli)

    cli.parse(['node', 'weapp-vite', 'prepare', '/project'], { run: false })
    await cli.runMatchedCommand()

    expect(createCompilerContextMock).toHaveBeenCalledWith({
      cwd: '/project',
      isDev: false,
      mode: 'development',
      configFile: undefined,
    })
    expect(ensureFreshMock).toHaveBeenCalledTimes(1)
    expect(resetMock).toHaveBeenCalledTimes(1)
    expect(findAutoImportCandidatesMock).toHaveBeenCalledTimes(1)
    expect(registerPotentialComponentMock).toHaveBeenCalledTimes(2)
    expect(awaitManifestWritesMock).toHaveBeenCalledTimes(1)
    expect(loggerInfoMock).toHaveBeenCalledWith('已生成 .weapp-vite 支持文件。')
  })

  it('ignores duplicated prepare argv segments and still resolves root correctly', async () => {
    const ensureFreshMock = vi.fn().mockResolvedValue(undefined)
    const resetMock = vi.fn()
    const awaitManifestWritesMock = vi.fn().mockResolvedValue(undefined)

    createCompilerContextMock.mockResolvedValue({
      configService: {
        outDir: 'dist',
      },
      autoRoutesService: {
        isEnabled: () => true,
        ensureFresh: ensureFreshMock,
      },
      autoImportService: {
        reset: resetMock,
        registerPotentialComponent: vi.fn(),
        awaitManifestWrites: awaitManifestWritesMock,
      },
    })
    getAutoImportConfigMock.mockReturnValue(undefined)

    const { registerPrepareCommand } = await import('./prepare')
    const cli = cac('weapp-vite')
    registerPrepareCommand(cli)

    cli.parse(['node', 'weapp-vite', 'prepare', 'prepare', '/project'], { run: false })
    await cli.runMatchedCommand()

    expect(createCompilerContextMock).toHaveBeenCalledWith({
      cwd: '/project',
      isDev: false,
      mode: 'development',
      configFile: undefined,
    })
    expect(ensureFreshMock).toHaveBeenCalledTimes(1)
    expect(resetMock).not.toHaveBeenCalled()
    expect(awaitManifestWritesMock).not.toHaveBeenCalled()
  })

  it('warns and skips when prepare runs before project config is ready', async () => {
    createCompilerContextMock.mockRejectedValue(new Error('找不到项目配置文件：/project/project.config.json'))

    const { registerPrepareCommand } = await import('./prepare')
    const cli = cac('weapp-vite')
    registerPrepareCommand(cli)

    cli.parse(['node', 'weapp-vite', 'prepare', '/project'], { run: false })
    await expect(cli.runMatchedCommand()).resolves.toBeUndefined()

    expect(loggerWarnMock).toHaveBeenCalledWith(
      '[prepare] 跳过 .weapp-vite 支持文件预生成：找不到项目配置文件：/project/project.config.json',
    )
    expect(loggerInfoMock).not.toHaveBeenCalled()
  })
})
