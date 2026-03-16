import type { MutableCompilerContext } from '../../context'
import type { WxmlService } from '../wxmlPlugin'
import { Buffer } from 'node:buffer'
import fs from 'fs-extra'
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
    pathExists: vi.fn(async (filePath: string) => (filePath in mockFileSystem) || await actual.pathExists(filePath)),
    readFile: vi.fn(async (filePath: string, encoding?: any) => {
      if (filePath in mockFileSystem) {
        const content = mockFileSystem[filePath]
        const resolvedEncoding = typeof encoding === 'string' ? encoding : encoding?.encoding
        if (resolvedEncoding) {
          return content
        }
        return Buffer.from(content)
      }
      return await actual.readFile(filePath, encoding)
    }),
    stat: vi.fn(async (filePath: string) => {
      if (!(filePath in mockFileSystem)) {
        return await actual.stat(filePath)
      }
      return {
        mtimeMs: 1,
        size: Buffer.byteLength(mockFileSystem[filePath] ?? '', 'utf8'),
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
    if (content.includes('<import src="/header.wxml" />')) {
      return {
        deps: [
          { tagName: 'import', value: '/header.wxml' },
        ],
      }
    }
    return {
      deps: [],
    }
  }),
  isImportTag: vi.fn(tagName => tagName === 'import'),
}))

vi.mock('@/utils', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, any>
  return {
    ...actual,
    isTemplate: vi.fn(value => value.endsWith('.wxml')),
  }
})

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
  let ctx: MutableCompilerContext
  let plugin: ReturnType<typeof createWxmlServicePlugin>
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
    relativeAbsoluteSrcRoot: vi.fn(filePath => filePath.replace('/mock/project/', '')),
    currentSubPackageRoot: undefined as string | undefined,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFileSystem['/mock/project/file.wxml'] = initialFileContent
    mockFileSystem['/mock/project/header.wxml'] = initialHeaderContent
    mockConfigService.currentSubPackageRoot = undefined
    ctx = {
      configService: mockConfigService,
      runtimeState: createRuntimeState(),
    } as unknown as MutableCompilerContext
    plugin = createWxmlServicePlugin(ctx)
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

    expect(result).toMatchObject({
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
    expect(firstScan).toMatchObject({
      deps: [{ tagName: 'import', value: './header.wxml' }],
    })

    mockFileSystem[filepath] = '<view>Updated</view>'

    const secondScan = await wxmlService.scan(filepath)
    expect(secondScan).toMatchObject({ deps: [] })
  })

  it('reuses cached token when file signature does not change', async () => {
    const filepath = '/mock/project/file.wxml'
    const first = await wxmlService.scan(filepath)
    const second = await wxmlService.scan(filepath)

    expect(second).toBe(first)
  })

  it('resolves absolute import template deps from src root', async () => {
    const filepath = '/mock/project/file.wxml'
    mockFileSystem[filepath] = '<import src="/header.wxml" />'

    const result = await wxmlService.scan(filepath)

    expect(result?.deps).toMatchObject([
      { tagName: 'import', value: '/header.wxml' },
    ])
    expect(wxmlService.depsMap.get(filepath)).toEqual(new Set(['/mock/project/header.wxml']))
  })

  it('throws non-ENOENT fs.stat errors during scan', async () => {
    vi.mocked(fs.stat).mockRejectedValueOnce(Object.assign(new Error('permission denied'), { code: 'EACCES' }))
    await expect(wxmlService.scan('/mock/project/file.wxml')).rejects.toThrow('permission denied')
  })

  it('buildStart clears only current subpackage state when subpackage root is set', () => {
    mockConfigService.currentSubPackageRoot = 'packageA'
    const packageAFile = '/mock/project/packageA/pages/a.wxml'
    const packageBFile = '/mock/project/packageB/pages/b.wxml'

    wxmlService.depsMap.set(packageAFile, new Set([packageBFile]))
    wxmlService.depsMap.set(packageBFile, new Set([packageAFile]))
    wxmlService.tokenMap.set(packageAFile, { deps: [] } as any)
    wxmlService.tokenMap.set(packageBFile, { deps: [] } as any)
    wxmlService.wxmlComponentsMap.set('/mock/project/packageA/pages/a', {} as any)
    wxmlService.wxmlComponentsMap.set('/mock/project/packageB/pages/b', {} as any)

    ctx.runtimeState.wxml.cache.set(packageAFile, { deps: [] } as any)
    ctx.runtimeState.wxml.cache.set(packageBFile, { deps: [] } as any)
    ctx.runtimeState.wxml.cache.mtimeMap.set(packageAFile, 1)
    ctx.runtimeState.wxml.cache.mtimeMap.set(packageBFile, 1)
    ctx.runtimeState.wxml.emittedCode.set('packageA/pages/a.wxml', 'a')
    ctx.runtimeState.wxml.emittedCode.set('packageB/pages/b.wxml', 'b')

    plugin.buildStart?.call({} as any)

    expect(wxmlService.depsMap.has(packageAFile)).toBe(false)
    expect(wxmlService.depsMap.get(packageBFile)?.has(packageAFile)).toBe(false)
    expect(wxmlService.tokenMap.has(packageAFile)).toBe(false)
    expect(wxmlService.tokenMap.has(packageBFile)).toBe(true)
    expect(wxmlService.wxmlComponentsMap.has('/mock/project/packageA/pages/a')).toBe(false)
    expect(wxmlService.wxmlComponentsMap.has('/mock/project/packageB/pages/b')).toBe(true)
    expect(ctx.runtimeState.wxml.cache.get(packageAFile)).toBeUndefined()
    expect(ctx.runtimeState.wxml.cache.get(packageBFile)).toBeTruthy()
    expect(ctx.runtimeState.wxml.cache.mtimeMap.has(packageAFile)).toBe(false)
    expect(ctx.runtimeState.wxml.cache.mtimeMap.has(packageBFile)).toBe(true)
    expect(ctx.runtimeState.wxml.emittedCode.has('packageA/pages/a.wxml')).toBe(false)
    expect(ctx.runtimeState.wxml.emittedCode.has('packageB/pages/b.wxml')).toBe(true)
  })
})
