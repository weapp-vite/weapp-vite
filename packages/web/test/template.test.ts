import { describe, expect, it } from 'vitest'
import { createTemplate } from '../src/runtime/template'

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
})
