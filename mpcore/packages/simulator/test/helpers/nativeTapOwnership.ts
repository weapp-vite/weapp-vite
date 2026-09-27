export const nativeTapOwnershipFiles: Array<[string, string]> = [
  ['app.json', JSON.stringify({ pages: ['pages/index/index', 'pages/detail/index'] })],
  ['app.js', `App({
    globalData: { stages: [], taps: [], nextPage: 0, nextComponent: 0 },
    onLaunch() {
      wx.onAppRouteDone(() => this.globalData.stages.push('done'))
    },
  })`],
  ['pages/index/index.json', JSON.stringify({ usingComponents: { 'tap-card': '/components/tap-card/index' } })],
  ['pages/index/index.js', `Page({
    data: { visible: true, action: 'remove' },
    onLoad() { this.identity = ++getApp().globalData.nextPage },
    onTap(event) {
      getApp().globalData.taps.push({
        owner: 'page', identity: this.identity, type: event.type,
        target: event.target.id, currentTarget: event.currentTarget.id, mark: event.mark,
      })
    },
    onClose(event) {
      this.onTap(event)
      this.setData({ visible: false })
      if (this.data.action === 'remove-and-render') {
        wx.createSelectorQuery().select('#outer').boundingClientRect().exec()
      }
      if (this.data.action === 'reLaunch') {
        wx.reLaunch({ url: '/pages/index/index?replacement=true' })
      }
    },
  })`],
  ['pages/index/index.wxml', '<view id="outer" bindtap="onTap"><tap-card id="card" wx:if="{{visible}}" bindclose="onClose" /></view>'],
  ['components/tap-card/index.json', JSON.stringify({ component: true })],
  ['components/tap-card/index.js', `Component({
    lifetimes: { created() { this.identity = ++getApp().globalData.nextComponent } },
    methods: {
      onTap(event) {
        getApp().globalData.taps.push({
          owner: 'component', identity: this.identity, type: event.type,
          target: event.target.id, currentTarget: event.currentTarget.id, mark: event.mark,
        })
      },
      close(event) {
        this.onTap(event)
        this.triggerEvent('close')
      },
    },
  })`],
  ['components/tap-card/index.wxml', '<navigator id="navigator" url="/pages/detail/index?from=default" bindtap="onTap"><view id="ancestor" bindtap="onTap"><text id="leaf" bindtap="close">close</text></view></navigator>'],
  ['pages/detail/index.js', 'Page({})'],
  ['pages/detail/index.wxml', '<view>detail</view>'],
]
