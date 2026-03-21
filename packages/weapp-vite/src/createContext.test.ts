import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createCompilerContext } from './createContext'

const resetCompilerContextMock = vi.hoisted(() => vi.fn())
const setActiveCompilerContextKeyMock = vi.hoisted(() => vi.fn())
const getCompilerContextMock = vi.hoisted(() => vi.fn())
const syncManagedTsconfigBootstrapFilesMock = vi.hoisted(() => vi.fn())
const syncProjectSupportFilesMock = vi.hoisted(() => vi.fn())
const loggerWarnMock = vi.hoisted(() => vi.fn())

vi.mock('./context/getInstance', () => ({
  getCompilerContext: getCompilerContextMock,
  resetCompilerContext: resetCompilerContextMock,
  setActiveCompilerContextKey: setActiveCompilerContextKeyMock,
}))

vi.mock('./runtime/tsconfigSupport', () => ({
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

  it('warns and auto-syncs when managed support files are stale', async () => {
    await createCompilerContext({
      cwd: '/project',
      mode: 'development',
    })

    expect(syncProjectSupportFilesMock).toHaveBeenCalledTimes(1)
    expect(loggerWarnMock).not.toHaveBeenCalledWith(expect.stringContaining('已自动重新生成'))

    syncProjectSupportFilesMock.mockResolvedValueOnce({
      managedTsconfigChanged: true,
    })

    await createCompilerContext({
      cwd: '/project',
      mode: 'development',
    })

    expect(loggerWarnMock).toHaveBeenCalledWith(
      '[prepare] 检测到 .weapp-vite 支持文件缺失或已过期，已自动重新生成。建议执行 weapp-vite prepare 并提交更新。',
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
})
