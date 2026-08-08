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
            <picker mode="selector" range="{{options}}" value="{{selected}}"><view>Picker</view></picker>
            <picker-view value="{{pickerValue}}">
              <picker-view-column><view>Column</view></picker-view-column>
            </picker-view>
            <slider value="42" show-value />
            <icon type="success" size="24" color="#09bb07" />
            <progress percent="{{progressValue}}" show-info active bindactiveend="handleActiveEnd" />
            <rich-text nodes="{{richNodes}}" user-select />
          </form>
          <scroll-view scroll-y="{{true}}"><view>Content</view></scroll-view>
          <navigator url="/pages/detail/index" extra-data="{{payload}}" hover-class="nav-active">Detail</navigator>
          <swiper current="1" indicator-dots>
            <swiper-item item-id="first">First</swiper-item>
            <swiper-item item-id="second">Second</swiper-item>
          </swiper>
          <canvas canvas-id="parity-canvas" disable-scroll></canvas>
          <video id="parity-video" src="/clip.mp4" object-fit="cover"></video>
          <cover-view class="overlay">Overlay</cover-view>
          <cover-image src="/cover.png" mode="aspectFit" />
          <movable-area><movable-view direction="horizontal">Move</movable-view></movable-area>
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
    expect(result.code).toContain('weapp-picker')
    expect(result.code).toContain('weapp-picker-view')
    expect(result.code).toContain('weapp-picker-view-column')
    expect(result.code).toContain('weapp-slider')
    expect(result.code).toContain('weapp-icon')
    expect(result.code).toContain('weapp-progress')
    expect(result.code).toContain('weapp-rich-text')
    expect(result.code).toMatch(/\.nodes=\$\{ctx\.eval\("richNodes", [^,]+, __wxs_modules\)\}/)
    expect(result.code).toContain('@activeend=')
    expect(result.code).toMatch(/\.range=\$\{ctx\.eval\("options", [^,]+, __wxs_modules\)\}/)
    expect(result.code).toMatch(/\.value=\$\{ctx\.eval\("pickerValue", [^,]+, __wxs_modules\)\}/)
    expect(result.code).toContain('weapp-scroll-view')
    expect(result.code).toContain('weapp-navigator')
    expect(result.code).toMatch(/\.extraData=\$\{ctx\.eval\("payload", [^,]+, __wxs_modules\)\}/)
    expect(result.code).toContain('hover-class=')
    expect(result.code).not.toContain('data-hover-class=')
    expect(result.code).toContain('weapp-swiper')
    expect(result.code).toContain('weapp-swiper-item')
    expect(result.code).toContain('weapp-canvas')
    expect(result.code).toContain('weapp-video')
    expect(result.code).toContain('weapp-cover-view')
    expect(result.code).toContain('weapp-cover-image')
    expect(result.code).toContain('weapp-movable-area')
    expect(result.code).toContain('weapp-movable-view')
    expect(result.code).toContain('canvas-id=')
    expect(result.code).toContain('object-fit=')
    expect(result.warnings).toBeUndefined()
  })

  it('keeps newly supported layer and movable components free of fallback warnings', () => {
    const result = compileWxml({
      id: '/src/pages/index/index.wxml',
      source: '<movable-area><movable-view>A</movable-view></movable-area>',
      resolveTemplatePath: () => undefined,
      resolveWxsPath: () => undefined,
    })
    expect(result.code).toContain('weapp-movable-area')
    expect(result.code).toContain('weapp-movable-view')
    expect(result.warnings).toBeUndefined()
  })
})
