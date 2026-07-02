import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createCompilerContext } from './createContext'

const resetCompilerContextMock = vi.hoisted(() => vi.fn())
const setActiveCompilerContextKeyMock = vi.hoisted(() => vi.fn())
const getCompilerContextMock = vi.hoisted(() => vi.fn())
const hasManagedTsconfigBootstrapCompletedMock = vi.hoisted(() => vi.fn())
const syncManagedTsconfigBootstrapFilesMock = vi.hoisted(() => vi.fn())
const syncProjectSupportFilesMock = vi.hoisted(() => vi.fn())
const loggerWarnMock = vi.hoisted(() => vi.fn())

vi.mock('./context/getInstance', () => ({
  getCompilerContext: getCompilerContextMock,
  resetCompilerContext: resetCompilerContextMock,
  setActiveCompilerContextKey: setActiveCompilerContextKeyMock,
}))

vi.mock('./runtime/tsconfigSupport', () => ({
  hasManagedTsconfigBootstrapCompleted: hasManagedTsconfigBootstrapCompletedMock,
  syncManagedTsconfigBootstrapFiles: syncManagedTsconfigBootstrapFilesMock,
}))

vi.mock('./runtime/supportFiles', () => ({
  syncProjectSupportFiles: syncProjectSupportFilesMock,
}))

vi.mock('./logger', () => ({
  default: {
    warn: loggerWarnMock,
  },
}))

describe('createCompilerContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hasManagedTsconfigBootstrapCompletedMock.mockReturnValue(false)
    syncManagedTsconfigBootstrapFilesMock.mockResolvedValue(false)
    getCompilerContextMock.mockReturnValue({
      configService: {
        load: vi.fn(async () => {}),
      },
      scanService: {
        loadAppEntry: vi.fn(async () => {}),
      },
    })
    syncProjectSupportFilesMock.mockResolvedValue({
      managedTsconfigChanged: false,
      managedTsconfigWarnings: [],
    })
  })

  it('continues loading config when managed tsconfig bootstrap fails', async () => {
    syncManagedTsconfigBootstrapFilesMock.mockRejectedValueOnce(new Error('bootstrap failed'))

    const ctx = await createCompilerContext({
      cwd: '/project',
      mode: 'development',
    })

    expect(syncManagedTsconfigBootstrapFilesMock).toHaveBeenCalledWith('/project')
    expect(loggerWarnMock).toHaveBeenCalledWith('[tsconfig] 跳过 .weapp-vite 支持文件预生成：bootstrap failed')
    expect(resetCompilerContextMock).toHaveBeenCalledWith('default')
    expect(setActiveCompilerContextKeyMock).toHaveBeenCalledWith('default')
    expect(ctx).toBe(getCompilerContextMock.mock.results[0]?.value)
    expect(ctx.configService.load).toHaveBeenCalledWith({
      cwd: '/project',
      mode: 'development',
    })
  })

  it('loads config while managed tsconfig bootstrap is still pending', async () => {
    let resolveBootstrap!: (changed: boolean) => void
    syncManagedTsconfigBootstrapFilesMock.mockReturnValueOnce(new Promise<boolean>((resolve) => {
      resolveBootstrap = resolve
    }))

    const ctx = {
      configService: {
        load: vi.fn(async () => {}),
      },
      scanService: {
        loadAppEntry: vi.fn(async () => {}),
      },
    }
    getCompilerContextMock.mockReturnValueOnce(ctx)

    const createPromise = createCompilerContext({
      cwd: '/project',
      mode: 'development',
    })

    await Promise.resolve()
    expect(ctx.configService.load).toHaveBeenCalledWith({
      cwd: '/project',
      mode: 'development',
    })
    expect(syncProjectSupportFilesMock).not.toHaveBeenCalled()

    resolveBootstrap(false)
    await createPromise

    expect(syncProjectSupportFilesMock).toHaveBeenCalledTimes(1)
  })

  it('skips duplicate managed tsconfig bootstrap for already bootstrapped cwd', async () => {
    hasManagedTsconfigBootstrapCompletedMock.mockReturnValueOnce(true)

    await createCompilerContext({
      cwd: '/project',
      mode: 'development',
    })

    expect(hasManagedTsconfigBootstrapCompletedMock).toHaveBeenCalledWith('/project')
    expect(syncManagedTsconfigBootstrapFilesMock).not.toHaveBeenCalled()
    expect(syncProjectSupportFilesMock).toHaveBeenCalledTimes(1)
  })

  it('warns and auto-syncs when managed support files are stale', async () => {
    await createCompilerContext({
      cwd: '/project',
      mode: 'development',
    })

    expect(syncProjectSupportFilesMock).toHaveBeenCalledTimes(1)
    expect(syncProjectSupportFilesMock).toHaveBeenCalledWith(expect.anything(), {
      syncAutoImport: undefined,
    })
    expect(loggerWarnMock).not.toHaveBeenCalledWith(expect.stringContaining('已自动重新生成'))

    syncProjectSupportFilesMock.mockResolvedValueOnce({
      managedTsconfigChanged: true,
      managedTsconfigWarnings: [],
    })

    await createCompilerContext({
      cwd: '/project',
      mode: 'development',
    })

    expect(loggerWarnMock).toHaveBeenCalledWith(
      '[prepare] 检测到 .weapp-vite 支持文件缺失或已过期，已自动重新生成。建议执行 wv prepare 并提交更新。',
    )
  })

  it('prints detailed managed tsconfig warnings', async () => {
    syncProjectSupportFilesMock.mockResolvedValueOnce({
      managedTsconfigChanged: true,
      managedTsconfigWarnings: ['srcRoot mismatch'],
    })

    await createCompilerContext({
      cwd: '/project',
      mode: 'development',
    })

    expect(loggerWarnMock).toHaveBeenCalledWith('srcRoot mismatch')
    expect(loggerWarnMock).not.toHaveBeenCalledWith(
      '[prepare] 检测到 .weapp-vite 支持文件缺失或已过期，已自动重新生成。建议执行 wv prepare 并提交更新。',
    )
  })

  it('continues when auto-syncing managed support files fails', async () => {
    syncProjectSupportFilesMock.mockRejectedValueOnce(new Error('support sync failed'))

    await expect(createCompilerContext({
      cwd: '/project',
      mode: 'development',
    })).resolves.toBeTruthy()

    expect(loggerWarnMock).toHaveBeenCalledWith(
      '[prepare] 自动同步 .weapp-vite 支持文件失败：support sync failed',
    )
  })

  it('can skip auto-syncing managed support files', async () => {
    await createCompilerContext({
      cwd: '/project',
      mode: 'development',
      syncSupportFiles: false,
    })

    expect(syncProjectSupportFilesMock).not.toHaveBeenCalled()
  })

  it('can skip blocking auto-import support file generation', async () => {
    await createCompilerContext({
      cwd: '/project',
      mode: 'development',
      syncAutoImportSupportFiles: false,
    })

    expect(syncProjectSupportFilesMock).toHaveBeenCalledWith(expect.anything(), {
      syncAutoImport: false,
    })
  })
})
