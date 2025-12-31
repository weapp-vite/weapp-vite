import { describe, expect, it } from 'vitest'
import { changeFileExtension } from '@/utils'
import { getCssRealPath, parseRequest } from './parse' // 替换为实际文件路径

// 模拟 `changeFileExtension` 方法
vi.mock('@/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils')>()
  return {
    changeFileExtension: vi.fn((filename: string, extension: string) => {
      return actual.changeFileExtension(filename, extension)
    }),

  }
})

describe('parseRequest', () => {
  it('should parse a request with no query string', () => {
    const id = 'example/file.js'
    const result = parseRequest(id)

    expect(result).toEqual({
      filename: 'example/file.js',
      query: {},
    })
  })

  it('should parse a request with a query string', () => {
    const id = 'example/file.js?wxss=true'
    const result = parseRequest(id)

    expect(result).toEqual({
      filename: 'example/file.js',
      query: { wxss: true },
    })
  })

  it('should parse a request with multiple query parameters', () => {
    const id = 'example/file.js?param1=value1&wxss=true'
    const result = parseRequest(id)

    expect(result).toEqual({
      filename: 'example/file.js',
      query: { param1: 'value1', wxss: true },
    })
  })

  it('should handle an empty string', () => {
    const id = ''
    const result = parseRequest(id)

    expect(result).toEqual({
      filename: '',
      query: {},
    })
  })
})

describe('getCssRealPath', () => {
  it('should return the original filename if "wxss" is not in the query', () => {
    const res = {
      filename: 'example/file.js',
      query: {},
    }
    const result = getCssRealPath(res)

    expect(result).toBe('example/file.js')
  })

  it('should return the filename with the "wxss" extension if "wxss" is in the query', () => {
    const res = {
      filename: 'example/file.js',
      query: { wxss: true },
    }
    const result = getCssRealPath(res)

    expect(result).toBe('example/file.wxss')
    expect(changeFileExtension).toHaveBeenCalledWith('example/file.js', 'wxss')
  })

  it('should handle files without extensions', () => {
    const res = {
      filename: 'example/file',
      query: { wxss: true },
    }
    const result = getCssRealPath(res)

    expect(result).toBe('example/file.wxss')
    expect(changeFileExtension).toHaveBeenCalledWith('example/file', 'wxss')
  })

  it('should handle empty filename', () => {
    const res = {
      filename: '',
      query: { wxss: true },
    }
    const result = getCssRealPath(res)

    expect(result).toBe('')
    expect(changeFileExtension).toHaveBeenCalledWith('', 'wxss')
  })
})
