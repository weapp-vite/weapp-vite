export const routeEventFiles: Array<[string, string]> = [
  ['app.json', JSON.stringify({
    pages: ['pages/home/index', 'pages/detail/index', 'pages/other/index', 'pages/tab-a/index', 'pages/tab-b/index'],
    tabBar: { list: [
      { pagePath: 'pages/tab-a/index', text: 'A' },
      { pagePath: 'pages/tab-b/index', text: 'B' },
    ] },
  })],
  ['app.js', `
App({
  globalData: { events: [], order: [], unloadedPages: [] },
  getWx() { return wx },
  onLaunch() {
    const record = (stage, event) => {
      const pages = getCurrentPages()
      this.globalData.order.push(stage + ':' + event.path)
      this.globalData.events.push({
        stage, path: event.path, query: event.query, openType: event.openType,
        routeEventId: event.routeEventId, webviewId: event.webviewId,
        renderer: event.renderer, timeStamp: event.timeStamp,
        stack: pages.map(page => page.route),
        ready: pages[pages.length - 1]?.data.ready === true,
        pageInStack: event.page ? pages.includes(event.page) : undefined,
        unloaded: event.page?.data.unloaded,
      })
      if (event.page) this.globalData.unloadedPages.push(event.page)
    }
    wx.onBeforeAppRoute(event => record('before', event))
    wx.onBeforePageUnload(event => record('unload', event))
    wx.onAppRoute(event => record('route', event))
    wx.onAppRouteDone(event => record('done', event))
  },
})
`],
  ...['home', 'detail', 'other', 'tab-a', 'tab-b'].flatMap((name): Array<[string, string]> => [
    [`pages/${name}/index.json`, JSON.stringify({ usingComponents: { child: '/components/child/index' } })],
    [`pages/${name}/index.js`, `
Page({
  data: { ready: false, unloaded: false, top: 0, left: 0, secondTop: 0, scroll: {}, secondScroll: {} },
  onLoad(options) {
    this.mode = options.mode
    getApp().globalData.order.push('load:' + this.route)
    if (this.mode === 'throw') throw new Error('route-load-failed')
    if (this.mode === 'redirect-load') wx.redirectTo({ url: '/pages/other/index' })
  },
  onShow() { getApp().globalData.order.push('show:' + this.route) },
  onHide() { getApp().globalData.order.push('hide:' + this.route) },
  onReady() {
    getApp().globalData.order.push('ready:' + this.route)
    this.setData({ ready: true })
    if (this.mode === 'redirect-ready') wx.redirectTo({ url: '/pages/other/index' })
  },
  onUnload() {
    getApp().globalData.order.push('destroy:' + this.route)
    this.setData({ unloaded: true })
  },
  onScroll(event) { this.setData({ scroll: event.detail }) },
  onSecondScroll(event) { this.setData({ secondScroll: event.detail }) },
  measure(selector) {
    return wx.createSelectorQuery().select(selector).scrollOffset().exec()[0]
  },
})
`],
    [`pages/${name}/index.wxml`, `
<view id="ready">{{ready}}</view>
<child />
<scroll-view id="primary" scroll-y scroll-x scroll-top="{{top}}" scroll-left="{{left}}" bindscroll="onScroll" style="height:100px;width:100px">
  <view style="height:2000px;width:1000px">content</view>
</scroll-view>
<scroll-view id="secondary" scroll-y scroll-top="{{secondTop}}" bindscroll="onSecondScroll" style="height:100px">
  <view style="height:2000px">second</view>
</scroll-view>
<navigator id="forward" url="/pages/detail/index?from=navigator"><text id="forward-label">open</text></navigator>
<navigator id="back" open-type="navigateBack">back</navigator>
<navigator id="tab" open-type="switchTab" url="/pages/tab-a/index">tab</navigator>
`],
  ]),
  ['components/child/index.json', '{"component":true}'],
  ['components/child/index.js', `Component({ lifetimes: {
    attached() { this.pageRoute = getCurrentPages().at(-1).route },
    detached() { getApp().globalData.order.push('detached:' + this.pageRoute) },
  } })`],
  ['components/child/index.wxml', '<view>child</view>'],
]
