import logger from '@/logger'
import path from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfigService, loadConfig } from './ConfigService'

// Mock fs-extra
vi.mock('fs-extra', () => ({
  exists: vi.fn(async filePath => filePath === '/mock/path/package.json'),
  readJson: vi.fn(async (filePath) => {
    if (filePath === '/mock/path/package.json') {
      return {
        dependencies: {
          'vue': '^3.0.0',
          'vue-router': '^4.0.0',
        },
      }
    }
    return {}
  }),
  default: {
    exists: vi.fn(async filePath => filePath === '/mock/path/package.json'),
    readJson: vi.fn(async (filePath) => {
      if (filePath === '/mock/path/package.json') {
        return {
          dependencies: {
            'vue': '^3.0.0',
            'vue-router': '^4.0.0',
          },
        }
      }
      return {}
    }),
  },
}))

// Mock @/defaults
vi.mock('@/defaults', () => ({
  defaultExcluded: ['node_modules/**'],
  getOutputExtensions: vi.fn(() => ({
    script: '.js',
    style: '.wxss',
  })),
  getWeappViteConfig: vi.fn(() => ({
    srcRoot: '/mock/src',
    platform: 'weapp',
  })),
}))

// Mock @/utils
vi.mock('@/utils', () => ({
  getProjectConfig: vi.fn(async (cwd) => {
    if (cwd === '/mock/path') {
      return {
        miniprogramRoot: 'dist/',
      }
    }
    return {}
  }),
  getAliasEntries: vi.fn(() => [
    { find: '@', replacement: '/mock/src' },
    { find: 'components', replacement: '/mock/src/components' },
  ]),
}))

// Mock vite
vi.mock('vite', () => ({
  loadConfigFromFile: vi.fn(async () => ({
    config: {
      weapp: {
        srcRoot: '/mock/src',
        tsconfigPaths: '/mock/tsconfig.json',
      },
    },
  })),
}))

// Mock @weapp-core/shared
// vi.mock('@weapp-core/shared', () => ({
//   addExtension: vi.fn((file, ext) => `${file}${ext}`),
//   removeExtension: vi.fn(file => file.replace(/\.\w+$/, '')),
//   defu: vi.fn((...configs) => Object.assign({}, ...configs)),
// }))

describe('configService', () => {
  let configService: ConfigService

  beforeEach(() => {
    configService = new ConfigService()
    vi.clearAllMocks()
  })

  describe('loadConfig', () => {
    it('should load configuration and return expected properties', async () => {
      const result = await loadConfig({
        cwd: '/mock/path',
        isDev: false,
        mode: 'production',
      })

      expect(result).toBeDefined()
      expect(result?.mpDistRoot).toBe('dist/')
      expect(result?.packageJson).toEqual({
        dependencies: {
          'vue': '^3.0.0',
          'vue-router': '^4.0.0',
        },
      })
      expect(result?.config.build?.rollupOptions?.output?.format).toBe('cjs')
    })

    it('should log an error if miniprogramRoot is not set', async () => {
      // expect(() => {
      //   return loadConfig({
      //     cwd: '/invalid/path',
      //     isDev: false,
      //     mode: 'production',
      //   })
      // }).toThrow('请在 `project.config.json` 里设置 `miniprogramRoot`, 比如可以设置为 `dist/` ')
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {})
      const result = await loadConfig({
        cwd: '/invalid/path',
        isDev: false,
        mode: 'production',
      })

      expect(loggerError).toHaveBeenCalledWith(
        '请在 `project.config.json` 里设置 `miniprogramRoot`, 比如可以设置为 `dist/` ',
      )
      expect(result).toBeUndefined()
    })
  })

  describe('configService.load', () => {
    it('should initialize options and outputExtensions', async () => {
      await configService.load({
        cwd: '/mock/path',
        isDev: true,
        mode: 'development',
      })

      expect(configService.options).toBeDefined()
      expect(configService.options.mpDistRoot).toBe('dist/')
      expect(configService.outputExtensions.script).toBe('.js')
    })

    it('should merge default options with provided options', async () => {
      await configService.load({
        cwd: '/mock/path',
      })

      expect(configService.options.cwd).toBe('/mock/path')
      expect(configService.options.isDev).toBe(false)
      expect(configService.options.mode).toBe('development')
    })
  })

  describe.skip('configService.merge', () => {
    it('should return merged inline configuration for development mode', async () => {
      await configService.load({
        cwd: '/mock/path',
        isDev: true,
      })

      const result = configService.merge(undefined, { build: { minify: true } })
      expect(result.mode).toBe('development')
      expect(result.build.minify).toBe(true)
      expect(result.build.watch).toBeDefined()
    })

    it('should return merged inline configuration for production mode', async () => {
      await configService.load({
        cwd: '/mock/path',
        isDev: false,
      })

      const result = configService.merge(undefined, { build: { minify: true } })
      expect(result.mode).toBe('production')
      expect(result.build.minify).toBe(true)
      expect(result.build.watch).toBeUndefined()
    })
  })

  describe('configService getters', () => {
    it('should return correct values from getters', async () => {
      await configService.load({
        cwd: '/mock/path',
        isDev: false,
        mode: 'production',
      })

      expect(configService.cwd).toBe('/mock/path')
      expect(configService.isDev).toBe(false)
      expect(configService.mpDistRoot).toBe('dist/')
      expect(configService.outDir).toBe(path.resolve('/mock/path', 'dist/'))
    })
  })
})
