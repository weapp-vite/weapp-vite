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

  it('should transform wx directives for alipay output', () => {
    const data = {
      code: '<view wx:if="ok" wx:for="{{list}}" wx:key="id" />',
      wxsImportNormalizeTokens: [],
      removeWxsLangAttrTokens: [],
      inlineWxsTokens: [],
      eventTokens: [],
      directiveTokens: [
        { start: 6, end: 11, value: 'a:if' },
        { start: 17, end: 23, value: 'a:for' },
        { start: 35, end: 41, value: 'a:key' },
      ],
      tagNameTokens: [],
      commentTokens: [],
      removalRanges: [],
      components: {},
      deps: [],
    }

    const result = handleWxml(data)

    expect(result.code).toBe('<view a:if="ok" a:for="{{list}}" a:key="id" />')
  })

  it('should transform pascal-case tags for alipay output', () => {
    const data = {
      code: '<HelloWorld><InnerItem /></HelloWorld>',
      wxsImportNormalizeTokens: [],
      removeWxsLangAttrTokens: [],
      inlineWxsTokens: [],
      eventTokens: [],
      directiveTokens: [],
      tagNameTokens: [
        { start: 1, end: 11, value: 'hello-world' },
        { start: 13, end: 22, value: 'inner-item' },
        { start: 27, end: 37, value: 'hello-world' },
      ],
      commentTokens: [],
      removalRanges: [],
      components: {},
      deps: [],
    }

    const result = handleWxml(data)

    expect(result.code).toBe('<hello-world><inner-item /></hello-world>')
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

    const result = handleWxml(data, {
      scriptModuleExtension: 'sjs',
      scriptModuleTag: 'import-sjs',
    })

    expect(result.code).toBe('<import-sjs from="normalized/./file.wxs.sjs"></import-sjs>')
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

  it.each([
    ['weapp', 'wxml'],
    ['alipay', 'axml'],
    ['tt', 'ttml'],
    ['swan', 'swan'],
    ['jd', 'jxml'],
    ['xhs', 'xhsml'],
  ])('rewrites template import extension for %s', (_platform, extension) => {
    const code = '<import src="./card.html" />'
    const value = './card.html'
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

    const result = handleWxml(data, { templateExtension: extension })

    expect(result.code).toBe(`<import src="./card.${extension}" />`)
  })

  it.each([
    ['alipay', 'sjs', '<wxs src="./helper.wxs"></wxs>', '<import-sjs from="normalized/./helper.wxs.sjs"></import-sjs>', 'import-sjs'],
    ['swan', 'sjs', '<wxs src="./helper.wxs"></wxs>', '<sjs src="normalized/./helper.wxs.sjs"></sjs>', undefined],
  ])('rewrites script module for %s', (_platform, extension, code, expected, scriptModuleTag) => {
    const value = './helper.wxs'
    const srcStart = code.indexOf(value)
    const closeTagStart = code.lastIndexOf('</wxs>')
    const closeNameStart = closeTagStart + 2
    const data = {
      code,
      wxsImportNormalizeTokens: [{ start: srcStart, end: srcStart + value.length, value }],
      templateImportNormalizeTokens: [],
      removeWxsLangAttrTokens: [],
      inlineWxsTokens: [],
      scriptModuleTagTokens: [
        { start: 1, end: 4, value: 'wxs' },
        { start: closeNameStart, end: closeNameStart + 3, value: 'wxs' },
      ],
      eventTokens: [],
      commentTokens: [],
      removalRanges: [],
      components: {},
      deps: [],
    }

    const result = handleWxml(data, { scriptModuleExtension: extension, scriptModuleTag })

    expect(result.code).toBe(expected)
  })

  it('uses extension-derived default script module tag when explicit tag is omitted', () => {
    const value = './helper.wxs'
    const code = '<wxs src="./helper.wxs"></wxs>'
    const srcStart = code.indexOf(value)
    const closeTagStart = code.lastIndexOf('</wxs>')
    const closeNameStart = closeTagStart + 2
    const data = {
      code,
      wxsImportNormalizeTokens: [{ start: srcStart, end: srcStart + value.length, value }],
      templateImportNormalizeTokens: [],
      removeWxsLangAttrTokens: [],
      inlineWxsTokens: [],
      scriptModuleTagTokens: [
        { start: 1, end: 4, value: 'wxs' },
        { start: closeNameStart, end: closeNameStart + 3, value: 'wxs' },
      ],
      eventTokens: [],
      commentTokens: [],
      removalRanges: [],
      components: {},
      deps: [],
    }

    const result = handleWxml(data, { scriptModuleExtension: 'sjs' })

    expect(result.code).toBe('<sjs src="normalized/./helper.wxs.sjs"></sjs>')
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

  it('replaces import.meta.env expressions in wxml output', () => {
    const code = '<image src="{{import.meta.env.VITE_CDN}}/logo.png" data-env="{{import.meta.env}}" />'
    const data = {
      code,
      wxsImportNormalizeTokens: [],
      templateImportNormalizeTokens: [],
      removeWxsLangAttrTokens: [],
      inlineWxsTokens: [],
      scriptModuleTagTokens: [],
      eventTokens: [],
      commentTokens: [],
      removalRanges: [],
      components: {},
      deps: [],
    }

    const result = handleWxml(data, {
      defineImportMetaEnv: {
        'import.meta.env.VITE_CDN': '"https://static.example.com"',
        'import.meta.env': '{"VITE_CDN":"https://static.example.com"}',
      },
    })

    expect(result.code).toBe('<image src="{{"https://static.example.com"}}/logo.png" data-env="{{{"VITE_CDN":"https://static.example.com"}}}" />')
  })

  it('memoizes import.meta.env replacements with define values in cache key', () => {
    const data = {
      code: '<view>{{import.meta.env.VITE_NAME}}</view>',
      wxsImportNormalizeTokens: [],
      templateImportNormalizeTokens: [],
      removeWxsLangAttrTokens: [],
      inlineWxsTokens: [],
      scriptModuleTagTokens: [],
      eventTokens: [],
      commentTokens: [],
      removalRanges: [],
      components: {},
      deps: [],
    }

    const first = handleWxml(data, {
      defineImportMetaEnv: {
        'import.meta.env.VITE_NAME': '"first"',
      },
    })
    const second = handleWxml(data, {
      defineImportMetaEnv: {
        'import.meta.env.VITE_NAME': '"second"',
      },
    })

    expect(first.code).toBe('<view>{{"first"}}</view>')
    expect(second.code).toBe('<view>{{"second"}}</view>')
    expect(second).not.toBe(first)
  })

  it('does not recursively replace import.meta.env text that comes from replacement values', () => {
    const data = {
      code: '<view>{{import.meta.env.VITE_NAME}}</view>',
      wxsImportNormalizeTokens: [],
      templateImportNormalizeTokens: [],
      removeWxsLangAttrTokens: [],
      inlineWxsTokens: [],
      scriptModuleTagTokens: [],
      eventTokens: [],
      commentTokens: [],
      removalRanges: [],
      components: {},
      deps: [],
    }

    const result = handleWxml(data, {
      defineImportMetaEnv: {
        'import.meta.env.VITE_NAME': '"contains import.meta.env literally"',
        'import.meta.env': '{"VITE_NAME":"contains import.meta.env literally"}',
      },
    })

    expect(result.code).toBe('<view>{{"contains import.meta.env literally"}}</view>')
  })

  it('replaces import.meta.url, import.meta.dirname and bare import.meta in wxml output', () => {
    const data = {
      code: '<view data-url="{{import.meta.url}}" data-dir="{{import.meta.dirname}}" data-meta="{{import.meta}}" />',
      wxsImportNormalizeTokens: [],
      templateImportNormalizeTokens: [],
      removeWxsLangAttrTokens: [],
      inlineWxsTokens: [],
      scriptModuleTagTokens: [],
      eventTokens: [],
      commentTokens: [],
      removalRanges: [],
      components: {},
      deps: [],
    }

    const result = handleWxml(data, {
      defineImportMetaEnv: {
        'import.meta.url': '"/pages/issue-431/index.wxml"',
        'import.meta.dirname': '"/pages/issue-431"',
        'import.meta': '{"url":"/pages/issue-431/index.wxml","dirname":"/pages/issue-431","env":{"MODE":"production"}}',
      },
    })

    expect(result.code).toBe('<view data-url="{{"/pages/issue-431/index.wxml"}}" data-dir="{{"/pages/issue-431"}}" data-meta="{{{"url":"/pages/issue-431/index.wxml","dirname":"/pages/issue-431","env":{"MODE":"production"}}}}" />')
  })
})
