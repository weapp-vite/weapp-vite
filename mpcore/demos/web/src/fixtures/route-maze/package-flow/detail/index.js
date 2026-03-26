Page({
  data: {
    title: 'Detail',
    id: '',
    from: '',
    logs: [],
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message],
    })
  },
  onLoad(query) {
    this.setData({
      id: query?.id ?? '',
      from: query?.from ?? '',
    })
    this.push('detail:onLoad:' + JSON.stringify(query))
  },
  onShow() {
    this.push('detail:onShow')
  },
  jumpBackTwo() {
    wx.navigateBack({
      delta: 2,
    })
  },
  replaceInsights() {
    wx.redirectTo({
      url: '/pages/insights/index?from=detail',
    })
  },
})
