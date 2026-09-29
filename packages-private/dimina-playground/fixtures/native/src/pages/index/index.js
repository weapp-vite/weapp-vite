Page({
  data: { count: 0, events: 0, bridge: '等待宿主', failure: '' },
  increment() { this.setData({ count: this.data.count + 1 }) },
  changed() { this.setData({ events: this.data.events + 1 }) },
  navigate() { wx.navigateTo({ url: '/sub/detail/index' }) },
  bridgeSuccess() {
    wx.extBridge({ module: 'Playground', event: 'echo', data: { count: this.data.count }, success: result => this.setData({ bridge: result.message }) })
  },
  bridgeFailure() {
    wx.extBridge({ module: 'Playground', event: 'unknown', fail: error => this.setData({ failure: error.errMsg }) })
  },
})
