import { describe, expect, it } from 'vitest'
import { compileWxml } from '../src/compiler/wxml'

describe('compileWxml button mapping', () => {
  it('maps supported mini-program components to semantic runtime elements', () => {
    const result = compileWxml({
      id: '/src/pages/index/index.wxml',
      source: `
        <view>
          <text>Label</text>
          <image src="/cover.png" mode="aspectFit" />
          <button type="primary">OK</button>
          <form bindsubmit="submit">
            <label for="name">Name</label>
            <input id="name" name="name" value="hello" />
            <textarea name="bio" value="intro" />
            <checkbox-group name="features"><checkbox value="web" checked>Web</checkbox></checkbox-group>
            <radio-group name="channel"><radio value="stable" checked>Stable</radio></radio-group>
            <switch name="enabled" checked />
          </form>
          <scroll-view scroll-y="{{true}}"><view>Content</view></scroll-view>
        </view>
      `,
      resolveTemplatePath: () => undefined,
      resolveWxsPath: () => undefined,
    })
    expect(result.code).toContain('weapp-view')
    expect(result.code).toContain('weapp-text')
    expect(result.code).toContain('weapp-image')
    expect(result.code).toContain('weapp-button')
    expect(result.code).toContain('weapp-input')
    expect(result.code).toContain('weapp-form')
    expect(result.code).toContain('weapp-label')
    expect(result.code).toContain('weapp-textarea')
    expect(result.code).toContain('weapp-checkbox-group')
    expect(result.code).toContain('weapp-checkbox')
    expect(result.code).toContain('weapp-radio-group')
    expect(result.code).toContain('weapp-radio')
    expect(result.code).toContain('weapp-switch')
    expect(result.code).toContain('weapp-scroll-view')
    expect(result.warnings).toBeUndefined()
  })

  it('warns once when a known component uses DOM fallback semantics', () => {
    const result = compileWxml({
      id: '/src/pages/index/index.wxml',
      source: '<swiper><swiper-item>A</swiper-item><swiper-item>B</swiper-item></swiper>',
      resolveTemplatePath: () => undefined,
      resolveWxsPath: () => undefined,
    })
    expect(result.warnings).toEqual([
      expect.stringContaining('<swiper>'),
      expect.stringContaining('<swiper-item>'),
    ])
  })
})
