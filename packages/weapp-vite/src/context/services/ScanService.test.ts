import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ScanService } from './ScanService'

// Mock依赖模块
vi.mock('fs-extra', async (importOriginal) => {
  const actual = await importOriginal()
  const mockFileSystem: Record<string, any> = {
    '/mock/project/src/app.json': JSON.stringify({
      pages: ['pages/home/index'],
      subPackages: [
        {
          root: 'sub-packages/packageA',
          pages: ['index'],
        },
      ],
      usingComponents: {
        'custom-button': '/components/button',
      },
    }),
    '/mock/project/src/app.js': 'console.log("App entry")',
    '/mock/project/src/pages/home/index.json': JSON.stringify({
      usingComponents: {
        'custom-header': '/components/header',
      },
    }),
    '/mock/project/src/components/header/index.json': JSON.stringify({
      component: true,
    }),
    '/mock/project/src/components/button/index.json': JSON.stringify({
      component: true,
    }),
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
    stat: vi.fn(async filePath => ({
      isDirectory: () => filePath.endsWith('/components/header'),
    })),
  }
  return {
    ...x,
    default: x,
  }
})

vi.mock('@/utils', () => ({
  findJsEntry: vi.fn(async baseName => `${baseName}.js`),
  findJsonEntry: vi.fn(async baseName => `${baseName}.json`),
  findTemplateEntry: vi.fn(async baseName => `${baseName}.wxml`),
  resolveImportee: vi.fn(componentUrl => componentUrl),
}))

vi.mock('@weapp-core/shared', () => ({
  removeExtension: vi.fn(filePath => filePath.replace(/\.\w+$/, '')),
  isObject: vi.fn(obj => obj && typeof obj === 'object'),
  set: vi.fn(),
}))

vi.mock('../shared', () => ({
  debug: vi.fn(),
}))

// Mock依赖服务
const mockConfigService = {
  cwd: '/mock/project',
  srcRoot: 'src',
  relativeSrcRoot: vi.fn(path => path.replace('/mock/project/src/', '')),
  relativeCwd: vi.fn(path => path.replace('/mock/project/', '')),
  packageJson: {
    dependencies: {},
  },
  inlineConfig: {
    weapp: {
      enhance: {
        autoImportComponents: {
          resolvers: [],
        },
      },
    },
  },
}

const mockJsonService = {
  read: vi.fn(async (filePath) => {
    const fs = await vi.importActual<typeof import('fs-extra')>('fs-extra')
    return JSON.parse(await fs.readFile(filePath, 'utf8')) // 修复点：明确调用 fs.readFile
  }),
}

const mockSubPackageService = {
  metaMap: {},
}

const mockAutoImportService = {
  potentialComponentMap: new Map(),
}

const mockWxmlService = {
  clear: vi.fn(),
  scan: vi.fn(),
  setWxmlComponentsMap: vi.fn(),
  wxmlComponentsMap: new Map(),
}

describe.skip('scanService', () => {
  let scanService: ScanService

  beforeEach(() => {
    vi.clearAllMocks()
    scanService = new ScanService(
      mockConfigService as any,
      mockJsonService as any,
      mockSubPackageService as any,
      mockAutoImportService as any,
    )
  })

  describe('scanAppEntry', () => {
    it('should scan the app.json and populate appEntry and pagesSet', async () => {
      const appEntry = await scanService.scanAppEntry()

      expect(appEntry).toBeDefined()
      expect(appEntry?.path).toBe('/mock/project/src/app.js')
      expect(scanService.pagesSet.has('pages/home/index')).toBe(true)
      expect(scanService.pagesSet.has('sub-packages/packageA/index')).toBe(true)
    })

    it('should throw an error if app.json or app.js is missing', async () => {
      vi.mocked(mockJsonService.read).mockImplementationOnce(async () => {
        throw new Error('File not found')
      })

      await expect(scanService.scanAppEntry()).rejects.toThrow(
        `在 /mock/project/src 目录下没有找到 \`app.json\`, 请确保你初始化了小程序项目，或者在 \`vite.config.ts\` 中设置的正确的 \`weapp.srcRoot\` 配置路径`,
      )
    })
  })

  describe('scanComponentEntry', () => {
    it('should scan and handle component entries', async () => {
      await scanService.scanComponentEntry('components/header/index', '/mock/project/src')

      const entriesSet = scanService.entriesSet
      expect(entriesSet.has('/mock/project/src/components/header/index.js')).toBe(true)
      expect(mockWxmlService.scan).toHaveBeenCalledWith('/mock/project/src/components/header/index.wxml')
      expect(mockWxmlService.setWxmlComponentsMap).toHaveBeenCalled()
    })

    it('should correctly identify pages vs components', async () => {
      await scanService.scanComponentEntry('pages/home/index', '/mock/project/src')

      const entriesSet = scanService.entriesSet
      expect(entriesSet.has('/mock/project/src/pages/home/index.js')).toBe(true)
      expect(mockWxmlService.scan).toHaveBeenCalledWith('/mock/project/src/pages/home/index.wxml')
    })
  })
})
