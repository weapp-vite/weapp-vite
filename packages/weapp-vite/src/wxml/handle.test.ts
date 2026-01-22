import MagicString from 'magic-string'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeWxsFilename, transformWxsCode } from '@/wxs'
import { handleWxml } from './handle' // 替换为实际模块路径
// 模拟 `normalizeWxsFilename` 与 `transformWxsCode` 方法
vi.mock('@/wxs', () => ({
  normalizeWxsFilename: vi.fn((filename, ext) => `normalized/${filename}.${ext}`),
  transformWxsCode: vi.fn(code => ({
    code: `transformed-${code}`,
  })),
}))

// 测试 `handleWxml`
describe('handleWxml', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should normalize wxs filenames', () => {
    const data = {
      code: '<wxs src="./file.wxs"/>',
      wxsImportNormalizeTokens: [{ start: 6, end: 17, value: './file.wxs' }],
      removeWxsLangAttrTokens: [],
      inlineWxsTokens: [],
      eventTokens: [],
      commentTokens: [],
      removalRanges: [],
      components: {},
      deps: [],
    }

    const result = handleWxml(data)

    expect(result.code).toContain('normalized/./file.wxs.wxs')
    expect(normalizeWxsFilename).toHaveBeenCalledWith('./file.wxs', 'wxs')
  })

  it('should remove wxs language attributes', () => {
    const data = {
      code: '<wxs src="./file.wxs" lang="ts"/>',
      wxsImportNormalizeTokens: [],
      removeWxsLangAttrTokens: [{ start: 21, end: 31, value: 'ts' }],
      inlineWxsTokens: [],
      eventTokens: [],
      commentTokens: [],
      removalRanges: [],
      components: {},
      deps: [],
    }

    const result = handleWxml(data)

    expect(result.code).not.toContain('lang="ts"')
  })

  it('should transform inline wxs code', () => {
    const data = {
      code: '<wxs module="test">console.log("test")</wxs>',
      wxsImportNormalizeTokens: [],
      removeWxsLangAttrTokens: [],
      inlineWxsTokens: [
        { start: 17, end: 41, value: 'console.log("test")' },
      ],
      eventTokens: [],
      commentTokens: [],
      removalRanges: [],
      components: {},
      deps: [],
    }

    const result = handleWxml(data)

    expect(result.code).toContain('<wxs module="test">console.log("test")</wxs>')
    expect(transformWxsCode).toHaveBeenCalledWith('console.log("test")', { extension: 'wxs' })
  })

  it('should transform event tokens', () => {
    const data = {
      code: '<button bindtap="handleClick"/>',
      wxsImportNormalizeTokens: [],
      removeWxsLangAttrTokens: [],
      inlineWxsTokens: [],
      eventTokens: [
        { start: 8, end: 26, value: 'bindtap="handleClick"' },
      ],
      commentTokens: [],
      removalRanges: [],
      components: {},
      deps: [],
    }

    const result = handleWxml(data)

    expect(result.code).toContain('bindtap="handleClick"')
  })

  it('should remove comments', () => {
    const data = {
      code: '<!-- This is a comment --><view></view>',
      wxsImportNormalizeTokens: [],
      removeWxsLangAttrTokens: [],
      inlineWxsTokens: [],
      eventTokens: [],
      commentTokens: [{ start: 0, end: 23, value: ' This is a comment ' }],
      removalRanges: [],
      components: {},
      deps: [],
    }

    const result = handleWxml(data)

    expect(result.code).not.toContain('<!-- This is a comment -->')
  })

  it('should remove code between start and end stacks', () => {
    const data = {
      code: '<view>Keep</view><view>Remove</view>',
      wxsImportNormalizeTokens: [],
      removeWxsLangAttrTokens: [],
      inlineWxsTokens: [],
      eventTokens: [],
      commentTokens: [],
      removalRanges: [
        {
          start: 17,
          end: 17 + '<view>Remove</view>'.length,
        },
      ],
      components: {},
      deps: [],
    }
    const ms = new MagicString(data.code)

    const result = handleWxml(data)
    ms.remove(data.removalRanges[0].start, data.removalRanges[0].end)
    expect(ms.toString()).toBe('<view>Keep</view>')
    expect(result.code).toBe('<view>Keep</view>') // 验证最终结果
  })

  it('memoizes results per token and options', () => {
    const code = '<!-- comment --><wxs src="./file.wxs"></wxs>'
    const src = './file.wxs'
    const srcStart = code.indexOf(src)
    const commentEnd = code.indexOf('<wxs')
    const data = {
      code,
      wxsImportNormalizeTokens: [
        { start: srcStart, end: srcStart + src.length, value: src },
      ],
      removeWxsLangAttrTokens: [],
      inlineWxsTokens: [],
      eventTokens: [],
      commentTokens: [{ start: 0, end: commentEnd, value: '' }],
      removalRanges: [],
      components: {},
      deps: [],
    }

    const first = handleWxml(data)
    expect(first.code).toBe('<wxs src="normalized/./file.wxs.wxs"></wxs>')
    expect(normalizeWxsFilename).toHaveBeenCalledTimes(1)

    const second = handleWxml(data)
    expect(second).toBe(first)
    expect(normalizeWxsFilename).toHaveBeenCalledTimes(1)

    const third = handleWxml(data, { removeComment: false })
    expect(third).not.toBe(first)
    expect(third.code).toContain('<!-- comment -->')
    expect(normalizeWxsFilename).toHaveBeenCalledTimes(2)
  })

  it('should rewrite wxs tag and src extension for sjs', () => {
    const data = {
      code: '<wxs src="./file.wxs"></wxs>',
      wxsImportNormalizeTokens: [{ start: 10, end: 20, value: './file.wxs' }],
      removeWxsLangAttrTokens: [],
      inlineWxsTokens: [],
      scriptModuleTagTokens: [
        { start: 1, end: 4, value: 'wxs' },
        { start: 24, end: 27, value: 'wxs' },
      ],
      eventTokens: [],
      commentTokens: [],
      removalRanges: [],
      components: {},
      deps: [],
    }

    const result = handleWxml(data, { scriptModuleExtension: 'sjs' })

    expect(result.code).toBe('<sjs src="normalized/./file.wxs.sjs"></sjs>')
  })

  it('should rewrite import src extension for templates', () => {
    const code = '<import src="./card.wxml" />'
    const value = './card.wxml'
    const start = code.indexOf(value)
    const data = {
      code,
      wxsImportNormalizeTokens: [],
      templateImportNormalizeTokens: [{ start, end: start + value.length, value }],
      removeWxsLangAttrTokens: [],
      inlineWxsTokens: [],
      scriptModuleTagTokens: [],
      eventTokens: [],
      commentTokens: [],
      removalRanges: [],
      components: {},
      deps: [],
    }

    const result = handleWxml(data, { templateExtension: 'axml' })

    expect(result.code).toBe('<import src="./card.axml" />')
  })

  it('reuses inline wxs transforms across instances', () => {
    const createData = (moduleName: string) => {
      const code = `<wxs module="${moduleName}">inline()</wxs>`
      const value = 'inline()'
      const start = code.indexOf(value)
      return {
        code,
        wxsImportNormalizeTokens: [],
        removeWxsLangAttrTokens: [],
        inlineWxsTokens: [{ start, end: start + value.length, value }],
        eventTokens: [],
        commentTokens: [],
        removalRanges: [],
        components: {},
        deps: [],
      }
    }

    handleWxml(createData('first'))
    expect(transformWxsCode).toHaveBeenCalledTimes(1)

    vi.mocked(transformWxsCode).mockClear()

    handleWxml(createData('second'))
    expect(transformWxsCode).not.toHaveBeenCalled()
  })
})
