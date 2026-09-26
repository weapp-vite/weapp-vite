export function createAppLaunchOptionsFiles(): Array<[string, string]> {
  return [
    ['app.json', JSON.stringify({ pages: ['pages/index/index', 'pages/next/index'] })],
    ['app.js', `App({
      globalData: { hooks: [] },
      onLaunch(options) { this.globalData.hooks.push({ hook: 'onLaunch', options }) },
      onShow(options) { this.globalData.hooks.push({ hook: 'onShow', options }) },
      captureOptions() { return { launch: wx.getLaunchOptionsSync(), enter: wx.getEnterOptionsSync() } },
    })`],
    ['pages/index/index.js', `Page({
      data: { hooks: [] },
      onLoad(query) {
        this.setData({
          query: JSON.stringify(query),
          launch: JSON.stringify(wx.getLaunchOptionsSync()),
          enter: JSON.stringify(wx.getEnterOptionsSync()),
          hooks: getApp().globalData.hooks.map(entry => ({
            hook: entry.hook,
            path: entry.options.path,
            query: JSON.stringify(entry.options.query),
            scene: String(entry.options.scene),
            referrer: JSON.stringify(entry.options.referrerInfo),
          })),
        })
      },
    })`],
    ['pages/index/index.wxml', `<view>
      <text id="page-query">{{query}}</text>
      <text id="launch-options">{{launch}}</text>
      <text id="enter-options">{{enter}}</text>
      <view wx:for="{{hooks}}" wx:key="hook" class="hook" id="{{item.hook}}">
        <text class="path">{{item.path}}</text>
        <text class="query">{{item.query}}</text>
        <text class="scene">{{item.scene}}</text>
        <text class="referrer">{{item.referrer}}</text>
      </view>
    </view>`],
    ['pages/next/index.js', 'Page({})'],
    ['pages/next/index.wxml', '<view>next</view>'],
  ]
}
