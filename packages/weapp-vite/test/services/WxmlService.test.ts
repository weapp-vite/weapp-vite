import type { ConfigService } from '@/context/services'
import { WxmlService } from '@/context/services'
// import { Symbols } from '@/context/Symbols'
import { scanWxml } from '@/wxml'
import fs from 'fs-extra'
import path from 'pathe'

// Mock依赖
vi.mock('fs-extra', () => ({
  readFile: vi.fn(),
  default: {
    readFile: vi.fn(),
  },
}))
vi.mock('@/wxml', () => ({
  scanWxml: vi.fn(),
  isImportTag: vi.fn(() => { return true }),
}))

describe('wxmlService', () => {
  let wxmlService: WxmlService
  let mockConfigService: ConfigService

  beforeEach(() => {
    // 创建Mock ConfigService
    mockConfigService = { platform: 'mock-platform' } as unknown as ConfigService

    // 实例化WxmlService
    wxmlService = new WxmlService(mockConfigService)

    // 重置Mock
    vi.clearAllMocks()
  })

  it('should add dependencies correctly', () => {
    const filepath = 'file1.wxml'
    const deps = ['file2.wxml', 'file3.wxml']

    wxmlService.addDeps(filepath, deps)

    const map = wxmlService.map.get(filepath)
    expect(map).toBeInstanceOf(Set)
    expect(map?.has('file2.wxml')).toBe(true)
    expect(map?.has('file3.wxml')).toBe(true)
  })

  it('should merge dependencies when adding to an existing filepath', () => {
    const filepath = 'file1.wxml'
    wxmlService.addDeps(filepath, ['file2.wxml'])
    wxmlService.addDeps(filepath, ['file3.wxml'])

    const map = wxmlService.map.get(filepath)
    expect(map?.has('file2.wxml')).toBe(true)
    expect(map?.has('file3.wxml')).toBe(true)
  })

  it('should return all dependencies', () => {
    wxmlService.addDeps('file1.wxml', ['file2.wxml', 'file3.wxml'])
    wxmlService.addDeps('file4.wxml', ['file5.wxml'])

    const allDeps = wxmlService.getAllDeps()
    expect(allDeps.has('file1.wxml')).toBe(true)
    expect(allDeps.has('file2.wxml')).toBe(true)
    expect(allDeps.has('file3.wxml')).toBe(true)
    expect(allDeps.has('file4.wxml')).toBe(true)
    expect(allDeps.has('file5.wxml')).toBe(true)
  })

  it('should clear all dependencies and tokens', () => {
    wxmlService.addDeps('file1.wxml', ['file2.wxml'])
    wxmlService.tokenMap.set('file1.wxml', { deps: [] } as any)

    wxmlService.clear()

    expect(wxmlService.map.size).toBe(0)
    expect(wxmlService.tokenMap.size).toBe(0)
  })

  it('should scan a file and update tokenMap and dependencies', async () => {
    const filepath = 'file1.wxml'
    const mockWxmlContent = '<view>Hello World</view>'
    const mockScanResult = {
      deps: [{ value: 'file2.wxml' }, { value: 'file3.wxml' }],
    }

    // Mock fs.readFile 和 scanWxml
    // @ts-ignore
    vi.mocked(fs.readFile).mockResolvedValue(mockWxmlContent)
    vi.mocked(scanWxml).mockReturnValue(mockScanResult as any)

    const result = await wxmlService.scan(filepath)

    expect(fs.readFile).toHaveBeenCalledWith(filepath, 'utf8')
    expect(scanWxml).toHaveBeenCalledWith(mockWxmlContent, { platform: 'mock-platform' })

    // 验证 tokenMap
    expect(wxmlService.tokenMap.get(filepath)).toEqual(mockScanResult)

    // 验证 map
    const set = wxmlService.map.get(filepath)
    const dir = path.dirname(filepath)
    expect(set?.has(path.resolve(dir, 'file2.wxml'))).toBe(true)
    expect(set?.has(path.resolve(dir, 'file3.wxml'))).toBe(true)

    // 验证返回值
    expect(result).toEqual(mockScanResult)
  })
})
