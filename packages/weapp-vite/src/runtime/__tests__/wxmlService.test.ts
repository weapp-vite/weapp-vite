import type { MutableCompilerContext } from '../../context'
import type { WxmlService } from '../wxmlPlugin'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtimeState'
import { createWxmlServicePlugin } from '../wxmlPlugin'

const initialFileContent = `
      <import src="./header.wxml" />
      <template name="header" />
    `
const initialHeaderContent = `
      <template name="header">
        <view>Header</view>
      </template>
    `

const mockFileSystem: Record<string, string> = {
  '/mock/project/file.wxml': initialFileContent,
  '/mock/project/header.wxml': initialHeaderContent,
}

vi.mock('fs-extra', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, any>
  const mockedModule = {
    ...actual,
    exists: vi.fn(async (filePath: string) => filePath in mockFileSystem),
    readFile: vi.fn(async (filePath: string) => {
      if (filePath in mockFileSystem) {
        return mockFileSystem[filePath]
      }
      throw new Error(`File not found: ${filePath}`)
    }),
    stat: vi.fn(async (filePath: string) => {
      if (!(filePath in mockFileSystem)) {
        const stat = await actual.stat(filePath)
        return stat
      }
      return {
        mtimeMs: 1,
      }
    }),
  }
  return {
    ...mockedModule,
    default: mockedModule,
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

vi.mock('../../context/shared', () => ({
  isEmptyObject: vi.fn(obj => Object.keys(obj).length === 0),
}))

vi.mock('../../logger', () => ({
  warn: vi.fn(),
  default: {
    warn: vi.fn(),
    success: vi.fn(),
  },
}))

describe('wxmlService', () => {
  let wxmlService: WxmlService
  const mockConfigService = {
    platform: 'weapp',
    weappViteConfig: {
      enhance: {
        wxml: true,
      },
    },
    absoluteSrcRoot: '/mock/project',
    relativeCwd: vi.fn(filePath => filePath.replace('/mock/project/', '')),
    relativeSrcRoot: vi.fn(filePath => filePath.replace('/mock/project/', '')),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFileSystem['/mock/project/file.wxml'] = initialFileContent
    mockFileSystem['/mock/project/header.wxml'] = initialHeaderContent
    const ctx = {
      configService: mockConfigService,
      runtimeState: createRuntimeState(),
    } as unknown as MutableCompilerContext
    createWxmlServicePlugin(ctx)
    wxmlService = ctx.wxmlService!
  })

  it('returns all dependencies including files and nested deps', async () => {
    await wxmlService.addDeps('/mock/project/file.wxml', ['./header.wxml'])
    const allDeps = wxmlService.getAllDeps()

    expect(allDeps).toEqual(new Set(['/mock/project/file.wxml', './header.wxml']))
  })

  it('clears dependency and token maps', () => {
    wxmlService.depsMap.set('/mock/project/file.wxml', new Set(['./header.wxml']))
    wxmlService.tokenMap.set('/mock/project/file.wxml', { deps: [] } as any)

    wxmlService.clearAll()

    expect(wxmlService.depsMap.size).toBe(0)
    expect(wxmlService.tokenMap.size).toBe(0)
  })

  it('scans file and caches result', async () => {
    const result = await wxmlService.scan('/mock/project/file.wxml')

    expect(result).toEqual({
      deps: [{ tagName: 'import', value: './header.wxml' }],
    })
    expect(wxmlService.depsMap.has('/mock/project/file.wxml')).toBe(true)
    expect(wxmlService.tokenMap.get('/mock/project/file.wxml')).toEqual(result)
  })

  it('stores component map when not empty', () => {
    wxmlService.setWxmlComponentsMap('/mock/project/file.wxml', {
      componentA: [
        { start: 0, end: 10 },
      ],
    })

    expect(wxmlService.wxmlComponentsMap.has('/mock/project/file')).toBe(true)
    expect(wxmlService.wxmlComponentsMap.get('/mock/project/file')).toEqual({
      componentA: [
        { start: 0, end: 10 },
      ],
    })
  })

  it('ignores empty component map', () => {
    wxmlService.setWxmlComponentsMap('/mock/project/file.wxml', {})

    expect(wxmlService.wxmlComponentsMap.has('/mock/project/file')).toBe(false)
  })

  it('re-scans when template content changes with identical mtime', async () => {
    const filepath = '/mock/project/file.wxml'
    const firstScan = await wxmlService.scan(filepath)
    expect(firstScan).toEqual({
      deps: [{ tagName: 'import', value: './header.wxml' }],
    })

    mockFileSystem[filepath] = '<view>Updated</view>'

    const secondScan = await wxmlService.scan(filepath)
    expect(secondScan).toEqual({ deps: [] })
  })
})
