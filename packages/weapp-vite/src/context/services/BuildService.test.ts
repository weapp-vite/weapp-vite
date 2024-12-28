/* eslint-disable ts/no-unsafe-function-type */
import process from 'node:process'
import path from 'pathe'
import { BuildService } from './BuildService'

// Mock模块需要在文件顶部，确保所有的依赖是在工厂函数中定义的
vi.mock('vite', () => ({
  build: vi.fn(async () => ({})), // Mock vite build
}))
vi.mock('del', () => {
  return {
    deleteAsync: vi.fn(async () => ['deleted/file/path']),
  }
})
vi.mock('../shared', () => ({
  debug: vi.fn(),
  logger: {
    success: vi.fn(),
  },
}))

describe('buildService', () => {
  // Mock依赖项
  const mockConfigService = {
    merge: vi.fn(() => ({})), // 返回一个空配置
    mpDistRoot: '/mock/dist',
    outDir: '/mock/out',
    isDev: false,
  }
  const mockWatcherService = {
    setRollupWatcher: vi.fn(),
  }
  const mockSubPackageService = {
    build: vi.fn(async () => {}),
  }

  let service: BuildService

  beforeEach(() => {
    service = new BuildService(
      mockConfigService as any,
      mockWatcherService as any,
      mockSubPackageService as any,
    )
    vi.clearAllMocks()
  })

  describe('runDev', () => {
    it.skip('should set NODE_ENV to development if undefined', async () => {
      delete process.env.NODE_ENV // 确保 NODE_ENV 未定义
      await service.runDev()

      expect(process.env.NODE_ENV).toBe('development')
    })

    it('should initialize Rollup watcher and set it in watcherService', async () => {
      const mockWatcher = {
        on: vi.fn((event: string, callback: Function) => {
          if (event === 'event') {
            callback({ code: 'END' }) // 模拟 END 事件
          }
        }),
      }
      const viteBuild = vi.mocked(await import('vite')).build
      viteBuild.mockResolvedValueOnce(mockWatcher)

      const watcher = await service.runDev()

      expect(viteBuild).toHaveBeenCalledWith(mockConfigService.merge())
      expect(mockWatcher.on).toHaveBeenCalledWith('event', expect.any(Function))
      expect(mockWatcherService.setRollupWatcher).toHaveBeenCalledWith(mockWatcher)
      expect(watcher).toBe(mockWatcher)
    })

    it('should handle watcher ERROR events', async () => {
      const mockWatcher = {
        on: vi.fn((event: string, callback: Function) => {
          if (event === 'event') {
            callback({ code: 'ERROR' }) // 模拟 ERROR 事件
          }
        }),
      }
      const viteBuild = vi.mocked(await import('vite')).build
      viteBuild.mockResolvedValueOnce(mockWatcher)

      await expect(service.runDev()).rejects.toThrowError()
    })
  })

  describe('runProd', () => {
    it('should perform a production build and call subPackageService.build', async () => {
      const mockOutput = { output: [] }
      const viteBuild = vi.mocked(await import('vite')).build
      viteBuild.mockResolvedValueOnce(mockOutput)

      const output = await service.runProd()

      expect(viteBuild).toHaveBeenCalledWith(mockConfigService.merge())
      expect(mockSubPackageService.build).toHaveBeenCalled()
      expect(output).toBe(mockOutput)
    })
  })

  describe('build', () => {
    it('should delete existing files in the output directory', async () => {
      mockConfigService.isDev = false

      await service.build()

      const deleteAsync = vi.mocked(await import('del')).deleteAsync
      expect(deleteAsync).toHaveBeenCalledWith(
        [path.resolve(mockConfigService.outDir, '**')],
        { ignore: ['**/miniprogram_npm/**'] },
      )
      const viteBuild = vi.mocked(await import('vite')).build
      expect(viteBuild).toHaveBeenCalled() // 确保调用了 build 方法
    })

    it('should run runDev in development mode', async () => {
      mockConfigService.isDev = true
      const runDevSpy = vi.spyOn(service, 'runDev').mockResolvedValue()

      await service.build()

      expect(runDevSpy).toHaveBeenCalled()
      const deleteAsync = vi.mocked(await import('del')).deleteAsync
      expect(deleteAsync).toHaveBeenCalled() // 确保清理了输出目录
    })

    it('should run runProd in production mode', async () => {
      mockConfigService.isDev = false
      const runProdSpy = vi.spyOn(service, 'runProd').mockResolvedValue({})

      await service.build()

      expect(runProdSpy).toHaveBeenCalled()
      const deleteAsync = vi.mocked(await import('del')).deleteAsync
      expect(deleteAsync).toHaveBeenCalled() // 确保清理了输出目录
    })
  })
})
