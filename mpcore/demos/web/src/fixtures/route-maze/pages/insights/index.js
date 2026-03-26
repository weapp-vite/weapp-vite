Page({
  data: {
    title: 'Insights',
    from: '',
    logs: [],
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message],
    })
  },
  onLoad(query) {
    this.setData({ from: query?.from ?? '' })
    this.push('insights:onLoad:' + JSON.stringify(query))
  },
  onShow() {
    this.push('insights:onShow')
  },
  replaceToQueue() {
    wx.redirectTo({
      url: '/package-flow/queue/index?from=insights',
    })
  },
})
