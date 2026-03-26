Page({
  data: {
    title: 'Media Library',
    entry: '',
    assets: [
      { id: 'asset-1', label: 'Lookbook Cover' },
      { id: 'asset-2', label: 'Studio Portrait' },
    ],
    logs: [],
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message],
    })
  },
  onLoad(query) {
    this.setData({ entry: query?.entry ?? '' })
    this.push('library:onLoad:' + JSON.stringify(query))
  },
  onShow() {
    this.push('library:onShow')
  },
  onPullDownRefresh() {
    this.push('library:onPullDownRefresh')
    wx.stopPullDownRefresh()
  },
  onReachBottom() {
    this.push('library:onReachBottom')
  },
  onRouteDone(options) {
    this.push('library:onRouteDone:' + JSON.stringify(options))
  },
  openAsset() {
    wx.navigateTo({
      url: '../asset/index?id=asset-2',
    })
  },
})
