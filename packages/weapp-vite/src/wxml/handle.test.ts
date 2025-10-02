import MagicString from 'magic-string'
import { describe, expect, it, vi } from 'vitest'
import { normalizeWxsFilename, transformWxsCode } from '@/wxs'
import { handleWxml } from './handle' // 替换为实际模块路径
// Mock `normalizeWxsFilename` 和 `transformWxsCode` 方法
vi.mock('@/wxs', () => ({
  normalizeWxsFilename: vi.fn(filename => `normalized/${filename}`),
  transformWxsCode: vi.fn(code => ({
    code: `transformed-${code}`,
  })),
}))

// 测试 `handleWxml`
describe('handleWxml', () => {
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

    expect(result.code).toContain('normalized/./file.wxs')
    expect(normalizeWxsFilename).toHaveBeenCalledWith('./file.wxs')
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
    expect(transformWxsCode).toHaveBeenCalledWith('console.log("test")')
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
})
