import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WxmlService } from './WxmlService'

// Mock相关模块
vi.mock('fs-extra', async (importOriginal) => {
  const actual = await importOriginal()
  const mockFileSystem: Record<string, any> = {
    '/mock/project/file.wxml': `
      <import src="./header.wxml" />
      <template name="header" />
    `,
    '/mock/project/header.wxml': `
      <template name="header">
        <view>Header</view>
      </template>
    `,
  }
  const x = {
    ...actual,
    exists: vi.fn(async filePath => filePath in mockFileSystem),
    readFile: vi.fn(async (filePath) => {
      if (filePath in mockFileSystem) {
        return mockFileSystem[filePath]
      }
      throw new Error(`File not found: ${filePath}`)
    }),
  }
  return {
    ...x,
    default: x,
  }
})

vi.mock('@/wxml', () => ({
  scanWxml: vi.fn((content) => {
    if (content.includes('<import src="./header.wxml" />')) {
      return {
        deps: [
          { tagName: 'import', value: './header.wxml' },
        ],
      }
    }
    return {
      deps: [],
    }
  }),
  isImportTag: vi.fn(tagName => tagName === 'import'),
}))

vi.mock('@/utils', () => ({
  isTemplate: vi.fn(value => value.endsWith('.wxml')),
}))

vi.mock('../shared', () => ({
  isEmptyObject: vi.fn(obj => Object.keys(obj).length === 0),
}))

vi.mock('@/logger', () => ({
  warn: vi.fn(),
  default: {
    warn: vi.fn(),
  },
}))

describe('wxmlService', () => {
  let wxmlService: WxmlService
  const mockConfigService = {
    platform: 'weapp',
    inlineConfig: {
      weapp: {
        enhance: {
          wxml: true,
        },
      },
    },
    relativeCwd: vi.fn(filePath => filePath.replace('/mock/project/', '')),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    wxmlService = new WxmlService(mockConfigService as any)
  })

  describe('addDeps', () => {
    it.skip('should add dependencies and scan them if not already present', async () => {
      await wxmlService.addDeps('/mock/project/file.wxml', ['./header.wxml'])

      expect(wxmlService.map.has('/mock/project/file.wxml')).toBe(true)
      expect(wxmlService.map.get('/mock/project/file.wxml')).toEqual(new Set(['./header.wxml']))

      const tokenMap = wxmlService.tokenMap.get('/mock/project/header.wxml')
      expect(tokenMap).toEqual({
        deps: [],
      })
    })
  })

  describe('getAllDeps', () => {
    it('should return all dependencies including files and their dependencies', async () => {
      await wxmlService.addDeps('/mock/project/file.wxml', ['./header.wxml'])
      const allDeps = wxmlService.getAllDeps()

      expect(allDeps).toEqual(new Set(['/mock/project/file.wxml', './header.wxml']))
    })
  })

  describe('clear', () => {
    it('should clear the map and tokenMap', () => {
      wxmlService.map.set('/mock/project/file.wxml', new Set(['./header.wxml']))
      wxmlService.tokenMap.set('/mock/project/file.wxml', { deps: [] })

      wxmlService.clear()

      expect(wxmlService.map.size).toBe(0)
      expect(wxmlService.tokenMap.size).toBe(0)
    })
  })

  describe('scan', () => {
    it('should scan a file and add its dependencies', async () => {
      const result = await wxmlService.scan('/mock/project/file.wxml')

      expect(result).toEqual({
        deps: [{ tagName: 'import', value: './header.wxml' }],
      })
      expect(wxmlService.map.has('/mock/project/file.wxml')).toBe(true)
      expect(wxmlService.tokenMap.get('/mock/project/file.wxml')).toEqual(result)
    })

    it.skip('should log a warning if the file does not exist', async () => {
      await wxmlService.scan('/mock/project/nonexistent.wxml')

      const logger = await import('@/logger')
      expect(logger.warn).toHaveBeenCalledWith('引用模板 nonexistent.wxml 不存在!')
    })
  })

  describe('setWxmlComponentsMap', () => {
    it('should set components map if components are not empty', () => {
      wxmlService.setWxmlComponentsMap('/mock/project/file.wxml', { componentA: './componentA.wxml' })

      expect(wxmlService.wxmlComponentsMap.has('/mock/project/file')).toBe(true)
      expect(wxmlService.wxmlComponentsMap.get('/mock/project/file')).toEqual({
        componentA: './componentA.wxml',
      })
    })

    it('should not set components map if components are empty', () => {
      wxmlService.setWxmlComponentsMap('/mock/project/file.wxml', {})

      expect(wxmlService.wxmlComponentsMap.has('/mock/project/file')).toBe(false)
    })
  })
})
