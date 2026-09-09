export const customTabBarFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ appid: 'wx123', miniprogramRoot: '.' })],
  ['app.json', JSON.stringify({
    pages: ['pages/a/index', 'pages/b/index', 'pages/detail/index'],
    tabBar: { custom: true, list: [
      { pagePath: 'pages/a/index', text: 'A' },
      { pagePath: 'pages/b/index', text: 'B' },
    ] },
  })],
  ['app.js', 'App({ globalData: { attached: 0, detached: 0 } })'],
  ['pages/a/index.js', 'Page({})'],
  ['pages/a/index.wxml', '<view id="layout"><text>page A</text></view>'],
  ['pages/b/index.js', 'Page({})'],
  ['pages/b/index.wxml', '<view id="layout"><text>page B</text></view>'],
  ['pages/detail/index.js', 'Page({})'],
  ['pages/detail/index.wxml', '<view id="detail">detail</view>'],
  ['custom-tab-bar/index.json', '{"component":true}'],
  ['custom-tab-bar/index.js', `
Component({
  data: { count: 0, ready: 0, layout: 'pending' },
  lifetimes: {
    attached() { getApp().globalData.attached++ },
    ready() {
      this.setData({ ready: this.data.ready + 1 })
      wx.createSelectorQuery().in(this).select('#layout').boundingClientRect().exec(results => {
        this.setData({ layout: results[0] ? 'inside' : 'outside' })
      })
    },
    detached() { getApp().globalData.detached++ },
  },
  methods: {
    increment() { this.setData({ count: this.data.count + 1 }) },
  },
})
`],
  ['custom-tab-bar/index.wxml', '<view class="custom-tab-bar"><button id="tab-counter" bindtap="increment">tab:{{count}}</button><text id="tab-ready">ready:{{ready}} {{layout}}</text></view>'],
]
