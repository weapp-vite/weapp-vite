import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NpmService } from './NpmService'

// Mock fs-extra
vi.mock('fs-extra', async (importOriginal) => {
  const actual = await importOriginal()
  const mockFileSystem: Record<string, any> = {
    '/mock/project/package.json': {
      dependencies: {
        'mock-dependency': '^1.0.0',
      },
    },
    '/mock/project/node_modules/mock-dependency/miniprogram_dist': 'mock-content',
  }
  const x = {
    ...actual,
    exists: vi.fn(async filePath => filePath in mockFileSystem),
    mkdir: vi.fn(async (dirPath) => {
      mockFileSystem[dirPath] = mockFileSystem[dirPath] || {}
    }),
    readJson: vi.fn(async (filePath) => {
      if (filePath in mockFileSystem) {
        return mockFileSystem[filePath]
      }
      throw new Error(`File not found: ${filePath}`)
    }),
    copy: vi.fn(async (src, dest) => {
      if (!(src in mockFileSystem)) {
        throw new Error(`Source not found: ${src}`)
      }
      mockFileSystem[dest] = mockFileSystem[src]
    }),
    outputJSON: vi.fn(async (filePath, content) => {
      mockFileSystem[filePath] = content
    }),
  }
  return {
    ...x,
    default: x,
  }
})

// Mock local-pkg
vi.mock('local-pkg', () => ({
  getPackageInfo: vi.fn(async (pkgName) => {
    if (pkgName === 'mock-dependency') {
      return {
        packageJson: {
          name: 'mock-dependency',
          version: '1.0.0',
          miniprogram: 'miniprogram_dist',
        },
        rootPath: '/mock/project/node_modules/mock-dependency',
      }
    }
    return null
  }),
  resolveModule: vi.fn(pkgName => `/mock/project/node_modules/${pkgName}/index.js`),
}))

// Mock tsup
vi.mock('tsup', () => ({
  build: vi.fn(async () => {}),
}))

// Mock @weapp-core/shared
vi.mock('@weapp-core/shared', () => ({
  defu: vi.fn((...configs) => Object.assign({}, ...configs)),
  isObject: vi.fn(obj => obj && typeof obj === 'object'),
  objectHash: vi.fn(obj => JSON.stringify(obj)),
}))

// Mock shared utilities
vi.mock('../shared', () => ({
  debug: vi.fn(),
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('npmService', () => {
  let npmService: NpmService
  const mockConfigService = {
    cwd: '/mock/project',
    packageJson: {
      dependencies: {
        'mock-dependency': '^1.0.0',
      },
    },
    projectConfig: {
      setting: {
        packNpmManually: false,
      },
    },
    inlineConfig: {
      weapp: {
        npm: {
          tsup: vi.fn(),
        },
      },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    npmService = new NpmService(mockConfigService as any)
  })

  describe('dependenciesCacheFilePath', () => {
    it('should return the correct cache file path', () => {
      const cacheFilePath = npmService.dependenciesCacheFilePath
      expect(cacheFilePath).toBe('/mock/project/node_modules/weapp-vite/.cache/npm.json')
    })
  })

  describe('dependenciesCacheHash', () => {
    it('should return the correct hash for dependencies', () => {
      const hash = npmService.dependenciesCacheHash
      expect(hash).toBe(JSON.stringify({ 'mock-dependency': '^1.0.0' }))
    })
  })

  describe('writeDependenciesCache', () => {
    it('should write dependencies cache to the correct file', async () => {
      const fs = await import('fs-extra')
      await npmService.writeDependenciesCache()

      expect(fs.outputJSON).toHaveBeenCalledWith('/mock/project/node_modules/weapp-vite/.cache/npm.json', {
        '/': JSON.stringify({ 'mock-dependency': '^1.0.0' }),
      })
    })
  })

  describe('checkDependenciesCacheOutdate', () => {
    it('should return true if cache is outdated', async () => {
      const fs = await import('fs-extra')
      vi.mocked(fs.readJson).mockResolvedValueOnce({ '/': 'old-hash' })

      const isOutdated = await npmService.checkDependenciesCacheOutdate()
      expect(isOutdated).toBe(true)
    })

    it('should return false if cache is up to date', async () => {
      const fs = await import('fs-extra')
      vi.mocked(fs.readJson).mockResolvedValueOnce({ '/': JSON.stringify({ 'mock-dependency': '^1.0.0' }) })

      const isOutdated = await npmService.checkDependenciesCacheOutdate()
      expect(isOutdated).toBe(false)
    })
  })

  describe('build', () => {
    it('should copy miniprogram-specific dependencies to the correct output directory', async () => {
      const fs = await import('fs-extra')
      await npmService.build()

      const logger = await import('../shared')
      expect(fs.copy).toHaveBeenCalledWith(
        '/mock/project/node_modules/mock-dependency/miniprogram_dist',
        '/mock/project/miniprogram_npm/mock-dependency',
      )
      expect(logger.logger.success).toHaveBeenCalledWith(' mock-dependency 依赖处理完成!')
    })

    it.skip('should use tsup to build non-miniprogram dependencies', async () => {
      const tsup = await import('tsup')
      vi.mocked(tsup.build).mockResolvedValueOnce(undefined)

      await npmService.build()

      // const resolveModule = await import('local-pkg')
      // expect(resolveModule.resolveModule).toHaveBeenCalledWith('mock-dependency')

      expect(tsup.build).toHaveBeenCalledWith({
        entry: {
          index: '/mock/project/node_modules/mock-dependency/index.js',
        },
        format: ['cjs'],
        outDir: '/mock/project/miniprogram_npm/mock-dependency',
        silent: true,
        shims: true,
        sourcemap: false,
        config: false,
        env: {
          NODE_ENV: 'production',
        },
        outExtension: expect.any(Function),
      })
    })

    it('should skip processing if cache is up to date', async () => {
      const fs = await import('fs-extra')
      vi.mocked(fs.exists).mockResolvedValueOnce(true)
      vi.mocked(fs.readJson).mockResolvedValueOnce({ '/': JSON.stringify({ 'mock-dependency': '^1.0.0' }) })

      await npmService.build()

      const logger = await import('../shared')
      expect(logger.logger.info).toHaveBeenCalledWith(' mock-dependency 依赖未发生变化，跳过处理!')
    })
  })
})
