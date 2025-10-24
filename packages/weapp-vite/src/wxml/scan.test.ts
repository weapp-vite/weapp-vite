// import { jsExtensions } from '@/constants'
// import { defu } from '@weapp-core/shared'
import { scanWxml } from './scan' // 替换为实际模块路径
// import { srcImportTagsMap } from './shared'

describe('scanWxml', () => {
  it('should scan components and collect their locations', () => {
    const wxml = '<view><custom-component></custom-component></view>'
    const result = scanWxml(wxml)

    expect(result.components).toEqual({
      'custom-component': [
        {
          start: 6,
          end: 43,
        },
      ],
    })
  })

  it('should collect dependencies for src attributes', () => {
    const wxml = '<wxs src="./file.wxs"/>'
    const result = scanWxml(wxml)

    expect(result.deps).toEqual([
      {
        name: 'src',
        value: './file.wxs',
        quote: '"',
        tagName: 'wxs',
        start: 5,
        end: 21,
        attrs: { src: './file.wxs' },
      },
    ])
    // expect(result.wxsImportNormalizeTokens).toEqual(
    //   [
    //     {
    //       start: 10,
    //       end: 19,
    //       value: './file.wxs',
    //     },
    //   ],
    // )
  })

  it('should handle inline wxs with lang attribute', () => {
    const wxml = '<wxs lang="ts">console.log("test")</wxs>'
    const result = scanWxml(wxml)

    expect(result.inlineWxsTokens).toEqual([
      {
        start: 15,
        end: 33,
        value: 'console.log("test")',
      },
    ])
    expect(result.removeWxsLangAttrTokens).toEqual([
      {
        start: 5,
        end: 14,
        value: 'ts',
      },
    ])
  })

  it('should handle event bindings and transform them', () => {
    const wxml = '<button @tap="handleClick"/>'
    const result = scanWxml(wxml)

    expect(result.eventTokens).toEqual([
      {
        start: 8,
        end: 12,
        value: 'bind:tap',
      },
    ])
  })

  it('should handle comments for conditional compilation', () => {
    const wxml = `
      <!-- #ifdef weapp -->
      <view>WeApp Specific</view>
      <!-- #endif -->
    `
    const result = scanWxml(wxml)

    expect(result.removalRanges).toEqual([])
    expect(result.commentTokens).toEqual([
      {
        start: 7,
        end: 28,
        value: '',
      },
      {
        start: 69,
        end: 84,
        value: '',
      },
    ])
  })

  it('should not remove platform-specific content for matching platform', () => {
    const wxml = `
      <!-- #ifdef weapp -->
      <view>WeApp Specific</view>
      <!-- #endif -->
    `
    const result = scanWxml(wxml, { platform: 'weapp' })

    expect(result.removalRanges).toEqual([])
  })

  it('should handle text content inside inline wxs', () => {
    const wxml = '<wxs lang="ts">const a = 1;</wxs>'
    const result = scanWxml(wxml)

    expect(result.inlineWxsTokens).toEqual([
      {
        start: 15,
        end: 26,
        value: 'const a = 1;',
      },
    ])
  })

  it('sorts removal ranges from inner to outer directives', () => {
    const wxml = `
      <!-- #ifdef weapp -->
      <view>
        <!-- #ifdef alipay -->
        <text>Inner</text>
        <!-- #endif -->
      </view>
      <!-- #endif -->
    `
    const result = scanWxml(wxml, { platform: 'tt' })

    expect(result.removalRanges.length).toBe(2)
    expect(result.removalRanges[0].start).toBeGreaterThan(result.removalRanges[1].start)
  })
})
