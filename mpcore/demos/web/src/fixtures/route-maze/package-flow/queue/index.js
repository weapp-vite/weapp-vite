Page({
  data: {
    title: 'Queue',
    from: '',
    cards: [
      { id: 'a-1', title: 'Alpha' },
      { id: 'b-2', title: 'Bravo' },
      { id: 'c-3', title: 'Charlie' }
    ],
    logs: [],
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message],
    })
  },
  onLoad(query) {
    this.setData({ from: query?.from ?? 'unknown' })
    this.push('queue:onLoad:' + JSON.stringify(query))
  },
  onShow() {
    this.push('queue:onShow')
  },
  onHide() {
    this.push('queue:onHide')
  },
  onUnload() {
    this.push('queue:onUnload')
  },
  openDetail() {
    wx.navigateTo({
      url: '../detail/index?id=b-2&from=queue',
    })
  },
  openMissing() {
    wx.navigateTo({
      url: '../ghost/index?from=queue',
      fail: (error) => this.push('queue:ghost:' + error.message),
      complete: () => this.push('queue:ghost:complete'),
    })
  },
  bounceSettings() {
    wx.switchTab({
      url: '/pages/settings/index',
    })
  },
})
