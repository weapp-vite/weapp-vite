import type { RollupWatcher } from 'rollup'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SubPackageService } from './SubPackageService'

// Mock相关模块
vi.mock('vite', () => ({
  build: vi.fn(async () => {
    return {
      on: vi.fn(),
    } as unknown as RollupWatcher
  }),
}))

vi.mock('../shared', () => ({
  debug: vi.fn(),
  logBuildIndependentSubPackageFinish: vi.fn(),
}))

describe('subPackageService', () => {
  let subPackageService: SubPackageService
  const mockConfigService = {
    options: {
      isDev: false,
    },
    merge: vi.fn((meta, config) => ({
      ...config,
      meta,
    })),
  }

  const mockNpmService = {
    build: vi.fn(async () => {}),
  }

  const mockWatcherService = {
    setRollupWatcher: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    subPackageService = new SubPackageService(
      mockConfigService as any,
      mockNpmService as any,
      mockWatcherService as any,
    )
    subPackageService.metaMap = {
      '/sub-package-a': {
        subPackage: {
          root: '/sub-package-a',
          dependencies: ['dep-a', 'dep-b'],
        },
      },
      '/sub-package-b': {
        subPackage: {
          root: '/sub-package-b',
          dependencies: ['dep-c'],
        },
      },
    }
  })

  describe('build', () => {
    it('should build all sub-packages in production mode', async () => {
      await subPackageService.build()

      // 验证是否调用了 npmService.build
      expect(mockNpmService.build).toHaveBeenCalledTimes(2)
      expect(mockNpmService.build).toHaveBeenCalledWith({
        root: '/sub-package-a',
        dependencies: ['dep-a', 'dep-b'],
      })
      expect(mockNpmService.build).toHaveBeenCalledWith({
        root: '/sub-package-b',
        dependencies: ['dep-c'],
      })

      // 验证是否调用了 vite.build
      const vite = await import('vite')
      expect(vite.build).toHaveBeenCalledTimes(2)

      // 验证是否记录了构建完成日志
      const { logBuildIndependentSubPackageFinish } = await import('../shared')
      expect(logBuildIndependentSubPackageFinish).toHaveBeenCalledWith('/sub-package-a')
      expect(logBuildIndependentSubPackageFinish).toHaveBeenCalledWith('/sub-package-b')
    })

    it('should build and watch sub-packages in development mode', async () => {
      mockConfigService.options.isDev = true

      const mockWatcher = {
        on: vi.fn((event, callback) => {
          if (event === 'event') {
            callback({ code: 'END' }) // 模拟 END 事件
          }
        }),
      } as unknown as RollupWatcher
      const vite = await import('vite')
      vi.mocked(vite.build).mockResolvedValue(mockWatcher)

      await subPackageService.build()

      // 验证是否设置了 RollupWatcher
      expect(mockWatcherService.setRollupWatcher).toHaveBeenCalledTimes(2)
      expect(mockWatcherService.setRollupWatcher).toHaveBeenCalledWith(mockWatcher, '/sub-package-a')
      expect(mockWatcherService.setRollupWatcher).toHaveBeenCalledWith(mockWatcher, '/sub-package-b')

      // 验证是否记录了构建完成日志
      const { logBuildIndependentSubPackageFinish } = await import('../shared')
      expect(logBuildIndependentSubPackageFinish).toHaveBeenCalledWith('/sub-package-a')
      expect(logBuildIndependentSubPackageFinish).toHaveBeenCalledWith('/sub-package-b')
    })

    it('should handle build errors gracefully', async () => {
      mockConfigService.options.isDev = true

      const mockWatcher = {
        on: vi.fn((event, callback) => {
          if (event === 'event') {
            callback({ code: 'ERROR' }) // 模拟 ERROR 事件
          }
        }),
      } as unknown as RollupWatcher
      const vite = await import('vite')
      vi.mocked(vite.build).mockResolvedValue(mockWatcher)

      await expect(subPackageService.build()).rejects.toThrow()

      // 验证是否尝试设置了 RollupWatcher
      expect(mockWatcherService.setRollupWatcher).toHaveBeenCalledTimes(1)

      // 验证是否处理了错误
      const { logBuildIndependentSubPackageFinish } = await import('../shared')
      expect(logBuildIndependentSubPackageFinish).not.toHaveBeenCalled()
    })
  })
})
