export const navigationCompletionRoutes = [
  'pages/home/index',
  'subpackages/normal/pages/entry/index',
  'subpackages/normal/pages/detail/index',
  'subpackages/independent/pages/entry/index',
  'subpackages/independent/pages/detail/index',
]

/** 复现稳定版原生 Page 的连续导航与 ready/callback 顺序。 */
export const navigationCompletionFiles: Array<[string, string]> = [
  ['app.json', JSON.stringify({
    pages: [navigationCompletionRoutes[0]],
    subPackages: [
      { root: 'subpackages/normal', pages: ['pages/entry/index', 'pages/detail/index'] },
      { root: 'subpackages/independent', pages: ['pages/entry/index', 'pages/detail/index'], independent: true },
    ],
  })],
  ['app.js', `App({ globalData: { order: [] }, getWx() { return wx } })`],
  ...navigationCompletionRoutes.flatMap((route): Array<[string, string]> => [
    [`${route}.json`, '{}'],
    [`${route}.wxml`, '<view id="ready">{{ready}}</view>'],
    [`${route}.js`, `Page({
      data: { ready: false },
      onLoad(options) {
        this.navigation = options
        getApp().globalData.order.push('load:' + this.route)
        if (options.redirect === 'onLoad') wx.redirectTo({ url: options.target })
      },
      onShow() { getApp().globalData.order.push('show:' + this.route) },
      onReady() {
        getApp().globalData.order.push('ready:' + this.route)
        this.setData({ ready: true })
        if (this.navigation.redirect === 'onReady') wx.redirectTo({ url: this.navigation.target })
      },
    })`],
  ]),
]
