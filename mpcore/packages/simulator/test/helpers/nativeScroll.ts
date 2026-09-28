export const nativeScrollFiles: Array<[string, string]> = [
  ['app.json', JSON.stringify({ pages: ['pages/index/index', 'pages/detail/index'] })],
  ['app.js', `App({
    globalData: { stages: [] },
    onLaunch() {
      wx.onBeforeAppRoute(() => this.globalData.stages.push('before'))
      wx.onBeforePageUnload(() => this.globalData.stages.push('unload'))
      wx.onAppRoute(() => this.globalData.stages.push('route'))
      wx.onAppRouteDone(() => this.globalData.stages.push('done'))
    },
  })`],
  ['pages/index/index.js', `Page({
    data: { top: 0, left: 0, height: 400, width: 300, content: true, x: true, y: true, scrolls: [], taps: [] },
    onScroll(event) { this.data.scrolls.push(event.detail) },
    onTap(event) {
      this.data.taps.push({ target: event.target.id, currentTarget: event.currentTarget.id })
    },
    measure(selector) { return wx.createSelectorQuery().select(selector).scrollOffset().exec()[0] },
  })`],
  ['pages/index/index.wxml', `
<scroll-view id="scroller" scroll-y="{{y}}" scroll-x="{{x}}" scroll-top="{{top}}" scroll-left="{{left}}" bindscroll="onScroll" style="height:100px;width:100px">
  <block wx:if="{{content}}"><block><!-- 逻辑分组不生成布局盒 --><view style="height:{{height}}px;width:{{width}}px">content</view></block></block>
</scroll-view>
<scroll-view id="empty" scroll-y scroll-x scroll-top="{{top}}" scroll-left="{{left}}" style="height:100px;width:100px" />
<scroll-view id="vertical" scroll-y scroll-top="{{top}}" style="height:100px"><view style="height:400px">vertical</view></scroll-view>
<scroll-view id="unsupported" class="scroller" scroll-y scroll-top="{{top}}"><view class="content">content</view></scroll-view>
<navigator id="forward" url="/pages/detail/index"><text id="unbound">open</text></navigator>
<navigator url="/pages/detail/index" bindtap="onTap"><view id="caught" catchtap="onTap">caught</view></navigator>
<navigator url="/pages/detail/index" bindtap="onTap"><view id="middle" catch:tap="onTap"><text id="nested" bindtap="onTap">nested</text><text id="nested-unbound">unbound</text></view></navigator>
<navigator id="own-catch" url="/pages/detail/index" catchtap="onTap">own catch</navigator>
<view id="ordinary" bindtap="onTap">not a navigator</view>
<view id="above" catchtap="onTap"><navigator url="/pages/detail/index"><text id="below-navigator">above catch</text></navigator></view>
`],
  ['pages/index/index.wxss', '.scroller { height: 100px; } .content { height: 1000px; }'],
  ['pages/detail/index.js', 'Page({})'],
  ['pages/detail/index.wxml', '<view>detail</view>'],
]
