import { cac } from 'cac'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const createCompilerContextMock = vi.hoisted(() => vi.fn())
const shouldBootstrapAutoImportWithoutGlobsMock = vi.hoisted(() => vi.fn())
const loggerInfoMock = vi.hoisted(() => vi.fn())
const loggerWarnMock = vi.hoisted(() => vi.fn())
const filterDuplicateOptionsMock = vi.hoisted(() => vi.fn())
const resolveConfigFileMock = vi.hoisted(() => vi.fn())
const syncProjectSupportFilesMock = vi.hoisted(() => vi.fn())

vi.mock('../../createContext', () => ({
  createCompilerContext: createCompilerContextMock,
}))

vi.mock('../../runtime/supportFiles', () => ({
  syncProjectSupportFiles: syncProjectSupportFilesMock,
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
    syncProjectSupportFilesMock.mockResolvedValue({
      managedTsconfigChanged: false,
    })
  })

  it('pre-generates auto routes and auto import outputs', async () => {
    createCompilerContextMock.mockResolvedValue({
      configService: {
        outDir: 'dist',
      },
    })

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
      syncSupportFiles: false,
      preloadAppEntry: false,
    })
    expect(syncProjectSupportFilesMock).toHaveBeenCalledTimes(1)
    expect(loggerInfoMock).toHaveBeenCalledWith('已生成 .weapp-vite 支持文件。')
  })

  it('ignores duplicated prepare argv segments and still resolves root correctly', async () => {
    createCompilerContextMock.mockResolvedValue({
      configService: {
        outDir: 'dist',
      },
    })

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
      syncSupportFiles: false,
      preloadAppEntry: false,
    })
    expect(syncProjectSupportFilesMock).toHaveBeenCalledTimes(1)
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

  it('warns and skips on unexpected prepare failures', async () => {
    createCompilerContextMock.mockRejectedValue(new Error('boom'))

    const { registerPrepareCommand } = await import('./prepare')
    const cli = cac('weapp-vite')
    registerPrepareCommand(cli)

    cli.parse(['node', 'weapp-vite', 'prepare', '/project'], { run: false })
    await expect(cli.runMatchedCommand()).resolves.toBeUndefined()

    expect(loggerWarnMock).toHaveBeenCalledWith(
      '[prepare] 跳过 .weapp-vite 支持文件预生成：boom',
    )
    expect(loggerInfoMock).not.toHaveBeenCalled()
  })

  it('warns and skips when managed tsconfig generation fails', async () => {
    createCompilerContextMock.mockResolvedValue({
      configService: {
        outDir: 'dist',
      },
      autoRoutesService: {
        isEnabled: () => false,
        ensureFresh: vi.fn(),
      },
      autoImportService: {
        reset: vi.fn(),
        registerPotentialComponent: vi.fn(),
        awaitManifestWrites: vi.fn(),
      },
    })
    syncProjectSupportFilesMock.mockRejectedValue(new Error('tsconfig failed'))

    const { registerPrepareCommand } = await import('./prepare')
    const cli = cac('weapp-vite')
    registerPrepareCommand(cli)

    cli.parse(['node', 'weapp-vite', 'prepare', '/project'], { run: false })
    await expect(cli.runMatchedCommand()).resolves.toBeUndefined()

    expect(loggerWarnMock).toHaveBeenCalledWith(
      '[prepare] 跳过 .weapp-vite 支持文件预生成：tsconfig failed',
    )
  })
})
