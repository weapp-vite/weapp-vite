import type { ConfigService, JsonService } from '.'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { logger, resolvedComponentName } from '../shared'
import { AutoImportService } from './AutoImportService'

// 模拟依赖项
const mockConfigService = {
  inlineConfig: {
    weapp: {
      enhance: {
        autoImportComponents: {
          globs: ['**/*.vue'], // 示例 glob 配置
        },
      },
    },
  },
  cwd: '/project',
  relativeSrcRoot: vi.fn((path: string) => `src/${path}`),
  relativeCwd: vi.fn((path: string) => `cwd/${path}`),
}

const mockJsonService = {
  read: vi.fn(async (_jsonPath: string) => ({
    component: true,
  })),
}

// 模拟工具函数
vi.mock('@/utils', () => ({
  findJsEntry: vi.fn(async (baseName: string) => `${baseName}.js`),
  findJsonEntry: vi.fn(async (baseName: string) => `${baseName}.json`),
}))

vi.mock('../shared', () => ({
  logger: {
    warn: vi.fn(),
  },
  resolvedComponentName: vi.fn((baseName: string) => baseName.replace(/-/g, '')),
}))

vi.mock('@weapp-core/shared', () => ({
  removeExtension: (filePath: string) => filePath.replace(/\.\w+$/, ''),
  removeExtensionDeep: (filePath: string) => filePath.replace(/\.\w+$/, ''),
}))

describe('autoImportService', () => {
  let service: AutoImportService

  beforeEach(() => {
    service = new AutoImportService(mockConfigService as unknown as ConfigService, mockJsonService as unknown as JsonService)
  })

  describe('scanPotentialComponentEntries', () => {
    it('should add a component entry to the potentialComponentMap', async () => {
      const filePath = 'components/test-component.vue'
      await service.scanPotentialComponentEntries(filePath)

      const componentName = resolvedComponentName('components/test-component')
      expect(service.potentialComponentMap.has(componentName)).toBe(true)
      const entry = service.potentialComponentMap.get(componentName)
      expect(entry?.value.name).toBe(componentName)
      expect(entry?.value.from).toBe('/src/cwd/components/test-component')
    })

    it('should skip if no JS entry is found', async () => {
      const filePath = 'components/test-component.vue'
      const mockFindJsEntry = vi.mocked(await import('@/utils')).findJsEntry
      mockFindJsEntry.mockResolvedValueOnce(null)

      await service.scanPotentialComponentEntries(filePath)

      expect(service.potentialComponentMap.size).toBe(0)
    })

    it('should log a warning if a component with the same name already exists', async () => {
      const filePath = 'components/test-component.vue'
      const componentName = resolvedComponentName('components/test-component')
      service.potentialComponentMap.set(componentName, { entry: {} as any, value: {} as any })

      await service.scanPotentialComponentEntries(filePath)

      expect(logger.warn).toHaveBeenCalledWith(
        `发现组件重名! 跳过组件 cwd/components/test-component 的自动引入`,
      )
    })

    it('should skip if JSON does not indicate a component', async () => {
      const filePath = 'components/test-component.vue'
      const mockRead = vi.mocked(mockJsonService.read)
      mockRead.mockResolvedValueOnce({ component: false })

      await service.scanPotentialComponentEntries(filePath)

      expect(service.potentialComponentMap.size).toBe(0)
    })
  })

  describe('filter', () => {
    it('should return true if id matches the configured globs', () => {
      const id = 'components/test-component.vue'
      const result = service.filter(id)

      expect(result).toBe(true)
    })

    it('should return false if id does not match the configured globs', () => {
      const id = 'components/test-component.js'
      const result = service.filter(id)

      expect(result).toBe(false)
    })

    it('should return false if no globs are configured', () => {
      mockConfigService.inlineConfig.weapp.enhance.autoImportComponents.globs = undefined
      const id = 'components/test-component.vue'
      const result = service.filter(id)

      expect(result).toBe(false)
    })
  })
})
