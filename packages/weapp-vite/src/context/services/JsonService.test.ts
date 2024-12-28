import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JsonService } from './JsonService'

// Mock 相关模块
vi.mock('fs-extra', async (importOriginal) => {
  const actual = await importOriginal() // 保留模块的原始方法
  const xx = {
    ...actual,
    readFile: vi.fn(async (filepath: string) => {
      if (filepath.endsWith('.json')) {
        return `{
          // 注释
          "key": "value"
        }`
      }
      throw new Error('File not found') // 模拟文件读取失败
    }),
  }
  return {
    ...xx,
    default: xx,
  }
})

vi.mock('bundle-require', () => ({
  bundleRequire: vi.fn(async ({ filepath }: { filepath: string }) => {
    if (filepath.endsWith('.json.js')) {
      return {
        mod: {
          default: {
            key: 'value-from-js',
          },
        },
      }
    }
    if (filepath.endsWith('.json.ts')) {
      return {
        mod: {
          default: async () => ({
            key: 'value-from-ts',
          }),
        },
      }
    }
    return { mod: {} }
  }),
}))

vi.mock('comment-json', () => ({
  parse: vi.fn((json: string) => JSON.parse(json.replace(/\/\/.*$/gm, ''))),
}))

vi.mock('../shared', () => ({
  logger: {
    error: vi.fn(),
  },
}))

// 测试 JsonService
describe('jsonService', () => {
  let jsonService: JsonService
  const mockConfigService = {
    options: {
      cwd: '/mock/project',
    },
    defineImportMetaEnv: {
      'import.meta.env.MODE': '"test"',
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    jsonService = new JsonService(mockConfigService as any)
  })

  describe('read', () => {
    it('should parse JSON file with comments', async () => {
      const result = await jsonService.read('/mock/project/file.json')
      expect(result).toEqual({
        key: 'value',
      })
    })

    it('should handle .json.js files and return the default export', async () => {
      const result = await jsonService.read('/mock/project/file.json.js')
      expect(result).toEqual({
        key: 'value-from-js',
      })
    })

    it.skip('should handle .json.ts files and execute the default function', async () => {
      const result = await jsonService.read('/mock/project/file.json.ts')
      expect(result).toEqual({
        key: 'value-from-ts',
      })
    })

    it('should log an error for invalid JSON files', async () => {
      const fs = await import('fs-extra')
      vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('Invalid file'))

      const result = await jsonService.read('/mock/project/invalid.json')
      expect(result).toBeUndefined()
      const logger = await import('../shared')
      expect(logger.logger.error).toHaveBeenCalledWith('残破的JSON文件: /mock/project/invalid.json')
      expect(logger.logger.error).toHaveBeenCalledWith(expect.any(Error))
    })

    it('should log an error if bundleRequire fails', async () => {
      const bundleRequire = await import('bundle-require')
      vi.mocked(bundleRequire.bundleRequire).mockRejectedValueOnce(new Error('Bundle failed'))

      const result = await jsonService.read('/mock/project/file.json.js')
      expect(result).toBeUndefined()
      const logger = await import('../shared')
      expect(logger.logger.error).toHaveBeenCalledWith('残破的JSON文件: /mock/project/file.json.js')
      expect(logger.logger.error).toHaveBeenCalledWith(expect.any(Error))
    })
  })
})
