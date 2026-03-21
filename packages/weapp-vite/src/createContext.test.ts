import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createCompilerContext } from './createContext'

const resetCompilerContextMock = vi.hoisted(() => vi.fn())
const setActiveCompilerContextKeyMock = vi.hoisted(() => vi.fn())
const getCompilerContextMock = vi.hoisted(() => vi.fn())
const syncManagedTsconfigBootstrapFilesMock = vi.hoisted(() => vi.fn())
const loggerWarnMock = vi.hoisted(() => vi.fn())

vi.mock('./context/getInstance', () => ({
  getCompilerContext: getCompilerContextMock,
  resetCompilerContext: resetCompilerContextMock,
  setActiveCompilerContextKey: setActiveCompilerContextKeyMock,
}))

vi.mock('./runtime/tsconfigSupport', () => ({
  syncManagedTsconfigBootstrapFiles: syncManagedTsconfigBootstrapFilesMock,
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
})
