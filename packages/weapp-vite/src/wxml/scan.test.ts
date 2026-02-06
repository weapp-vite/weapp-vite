import { scanWxml } from './scan' // 替换为实际模块路径

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

  it('should handle event bindings for alipay', () => {
    const wxml = '<button @tap="handleClick"/>'
    const result = scanWxml(wxml, { platform: 'alipay' })

    expect(result.eventTokens).toEqual([
      {
        start: 8,
        end: 12,
        value: 'onTap',
      },
    ])
  })

  it('should rewrite wx directives for alipay', () => {
    const wxml = '<view wx:if="ok" wx:for="{{list}}" wx:key="id" />'
    const result = scanWxml(wxml, { platform: 'alipay' })

    expect(result.directiveTokens).toEqual([
      {
        start: 6,
        end: 11,
        value: 'a:if',
      },
      {
        start: 17,
        end: 23,
        value: 'a:for',
      },
      {
        start: 35,
        end: 41,
        value: 'a:key',
      },
    ])
  })

  it('should rewrite pascal-case tags for alipay', () => {
    const wxml = '<HelloWorld><InnerItem /></HelloWorld>'
    const result = scanWxml(wxml, { platform: 'alipay' })

    expect(result.tagNameTokens).toEqual([
      {
        start: 1,
        end: 11,
        value: 'hello-world',
      },
      {
        start: 13,
        end: 22,
        value: 'inner-item',
      },
      {
        start: 27,
        end: 37,
        value: 'hello-world',
      },
    ])
  })

  it.each([
    ['weapp', '@tap', 'bind:tap'],
    ['weapp', '@tap.catch', 'catch:tap'],
    ['weapp', '@tap.capture', 'capture-bind:tap'],
    ['weapp', '@tap.capture.catch', 'capture-catch:tap'],
    ['weapp', '@tap.mut', 'mut-bind:tap'],
    ['tt', '@tap', 'bind:tap'],
    ['swan', '@tap.catch', 'catch:tap'],
    ['jd', '@tap.capture', 'capture-bind:tap'],
    ['xhs', '@tap.capture.catch', 'capture-catch:tap'],
    ['alipay', '@tap', 'onTap'],
    ['alipay', '@tap.catch', 'catchTap'],
    ['alipay', '@tap.capture', 'captureTap'],
    ['alipay', '@tap.capture.catch', 'captureCatchTap'],
    ['alipay', '@tap.mut', 'onTap'],
    ['alipay', 'bindtap', 'onTap'],
    ['alipay', 'bind:tap', 'onTap'],
    ['alipay', 'catchtap', 'catchTap'],
    ['alipay', 'catch:tap', 'catchTap'],
  ])('transforms %s event %s', (platform, raw, expected) => {
    const wxml = `<button ${raw}="handleClick"/>`
    const result = scanWxml(wxml, { platform: platform as any })

    expect(result.eventTokens).toEqual([
      {
        start: 8,
        end: 8 + raw.length,
        value: expected,
      },
    ])
  })

  it.each([
    ['bindtap', 'onTap'],
    ['bind:tap', 'onTap'],
    ['catchtap', 'catchTap'],
    ['catch:tap', 'catchTap'],
  ])('rewrites alipay native event binding %s -> %s', (raw, expected) => {
    const wxml = `<view ${raw}="onTap"/>`
    const result = scanWxml(wxml, { platform: 'alipay' })

    expect(result.eventTokens).toEqual([
      {
        start: 6,
        end: 6 + raw.length,
        value: expected,
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
