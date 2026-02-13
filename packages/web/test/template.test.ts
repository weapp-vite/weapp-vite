import { afterEach, describe, expect, it, vi } from 'vitest'
import { setRuntimeExecutionMode } from '../src/runtime/execution'
import { createTemplate } from '../src/runtime/template'
import { setRuntimeWarningOptions } from '../src/runtime/warning'

const helloWorldWxml = `<view class="hello-card">
  <view class="hello-title">{{title}}</view>
  <view class="hello-body">{{description}}</view>
  <view wx:if="{{links.length}}" class="hello-actions">
    <view
      wx:for="{{links}}"
      wx:key="url"
      class="hello-button {{item.variant === 'ghost' ? 'hello-button--ghost' : ''}}"
      data-url="{{item.url}}"
      bindtap="copyLink"
    >
      {{item.text}}
    </view>
  </view>
  <view wx:if="{{links.length}}" class="hello-tip">复制后即可在浏览器中打开对应链接</view>
</view>`

describe('createTemplate', () => {
  afterEach(() => {
    setRuntimeExecutionMode('compat')
    setRuntimeWarningOptions()
    vi.restoreAllMocks()
  })

  it('renders WXML template with data bindings', () => {
    const render = createTemplate(helloWorldWxml)
    const html = render({
      title: 'Hello weapp-vite',
      description: '欢迎使用 weapp-vite 模板。',
      links: [
        { text: '查看文档', url: 'https://vite.icebreaker.top', variant: 'ghost' },
        { text: 'GitHub', url: 'https://github.com/weapp-vite/weapp-vite' },
      ],
    })
    expect(html).toContain('<div class="hello-card">')
    expect(html).toContain('<div class="hello-title">Hello weapp-vite</div>')
    expect(html).toContain('<div class="hello-body">欢迎使用 weapp-vite 模板。</div>')
    expect(html).toContain('<div class="hello-actions">')
    expect(html).toContain('class="hello-button hello-button--ghost"')
    expect(html).toContain('data-url="https://vite.icebreaker.top"')
    expect(html).toContain('<div class="hello-tip">复制后即可在浏览器中打开对应链接</div>')
  })

  it('returns empty string when wx:if evaluates to false', () => {
    const render = createTemplate('<view wx:if="{{visible}}">hidden</view>')
    expect(render({ visible: false })).toBe('')
    expect(render({ visible: 0 })).toBe('')
    expect(render({ visible: true })).toBe('<div>hidden</div>')
  })

  it('renders wx:elif branches when previous conditions fail', () => {
    const render = createTemplate(`
<view>
  <view wx:if="{{status === 'loading'}}">loading</view>
  <view wx:elif="{{status === 'success'}}">success</view>
  <view wx:else>fallback</view>
</view>`)
    expect(render({ status: 'loading' }).trim()).toContain('<div>loading</div>')
    expect(render({ status: 'success' }).trim()).toContain('<div>success</div>')
    expect(render({ status: 'error' }).trim()).toContain('<div>fallback</div>')
  })

  it('skips wx:elif branches when a previous condition succeeds', () => {
    const render = createTemplate(`
<view>
  <view wx:if="{{flag}}">primary</view>
  <view wx:elif="{{flag === false}}">secondary</view>
  <view wx:else>tertiary</view>
</view>`)
    expect(render({ flag: true })).toContain('primary')
    expect(render({ flag: false })).toContain('secondary')
    expect(render({ flag: undefined })).toContain('tertiary')
  })

  it('maps event prefixes and aliases to runtime event bindings', () => {
    const render = createTemplate(`
<view>
  <view class="bind" bindtap="onBind">bind</view>
  <view class="catch" catchtap="onCatch">catch</view>
  <view class="capture" capture-bindtap="onCapture">capture</view>
  <view class="capture-catch" capture-catchtap="onCaptureCatch">captureCatch</view>
  <view class="longpress" bindlongpress="onLongPress">longpress</view>
</view>`)

    const html = render({})
    expect(html).toContain('class="bind" data-wx-on-click="onBind"')
    expect(html).toContain('class="catch" data-wx-on-click="onCatch" data-wx-on-flags-click="catch"')
    expect(html).toContain('class="capture" data-wx-on-click="onCapture" data-wx-on-flags-click="capture"')
    expect(html).toContain('class="capture-catch" data-wx-on-click="onCaptureCatch" data-wx-on-flags-click="capture,catch"')
    expect(html).toContain('class="longpress" data-wx-on-contextmenu="onLongPress"')
  })

  it('suppresses expression parse errors in safe mode', () => {
    setRuntimeExecutionMode('safe')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const render = createTemplate('<view>{{foo(}}</view>')
    expect(render({})).toBe('<div></div>')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('safe 模式下忽略表达式解析错误')
  })

  it('throws expression runtime errors in strict mode', () => {
    setRuntimeExecutionMode('strict')
    const render = createTemplate('<view>{{foo.bar}}</view>')
    expect(() => render({ foo: null })).toThrow(/strict 模式下表达式执行失败/)
  })

  it('can disable runtime warnings via warning level off', () => {
    setRuntimeExecutionMode('safe')
    setRuntimeWarningOptions({ level: 'off' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const render = createTemplate('<view>{{foo(}}</view>')
    expect(render({})).toBe('<div></div>')
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it('can route runtime warnings to console.error', () => {
    setRuntimeExecutionMode('safe')
    setRuntimeWarningOptions({ level: 'error' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const render = createTemplate('<view>{{bar(}}</view>')
    expect(render({})).toBe('<div></div>')
    expect(warn).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledTimes(1)
    expect(String(error.mock.calls[0]?.[0])).toContain('runtime:execution')
  })
})
