export const pageReadyFiles: Array<[string, string]> = [
  ['app.json', JSON.stringify({ pages: ['pages/index/index', 'pages/destination/index'] })],
  ['app.js', 'App({ globalData: { events: [] } })'],
  ['shared/lazy.js', 'exports.marker = "async-loaded"'],
  ['pages/index/index.js', `
Page({
  data: { label: 'pending' },
  async onLoad(options) {
    this.mode = options.mode
    getApp().globalData.events.push('load')
    if (this.mode === 'load-redirect') {
      wx.redirectTo({ url: '/pages/destination/index' })
      return
    }
    if (this.mode === 'pending') return new Promise(() => {})
    const mod = await Promise.resolve().then(() => Promise.resolve().then(() => require('../../shared/lazy.js')))
    this.loaded = mod.marker
    getApp().globalData.events.push('loaded')
  },
  onShow() {
    getApp().globalData.events.push('show')
    if (this.mode === 'show-redirect') wx.redirectTo({ url: '/pages/destination/index' })
  },
  onReady() {
    getApp().globalData.events.push('ready')
    if (this.mode === 'throw') throw new Error('page-ready-error')
    if (this.mode === 'ready-redirect') {
      wx.redirectTo({ url: '/pages/destination/index' })
      return
    }
    this.setData({ label: this.loaded || 'ready-without-load' })
  },
  onRouteDone() {
    getApp().globalData.events.push('routeDone')
  },
  onUnload() {
    getApp().globalData.events.push('unload')
  },
})
`],
  ['pages/index/index.wxml', '<text id="ready-label">{{label}}</text>'],
  ['pages/destination/index.js', `
Page({
  data: { ready: false },
  openIndex() {
    wx.navigateTo({
      url: '/pages/index/index',
      success: () => getApp().globalData.events.push('success'),
      complete: () => getApp().globalData.events.push('complete'),
    })
  },
  onReady() { this.setData({ ready: true }) },
})
`],
  ['pages/destination/index.wxml', '<text id="destination-ready">{{ready}}</text>'],
]
