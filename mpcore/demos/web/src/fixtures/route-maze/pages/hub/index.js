Page({
  data: {
    title: 'Route Maze Hub',
    status: 'idle',
    steps: ['hub', 'queue', 'detail', 'settings'],
    logs: [],
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message],
    })
  },
  onLoad(query) {
    this.push('hub:onLoad:' + JSON.stringify(query))
  },
  onShow() {
    this.push('hub:onShow')
  },
  onReady() {
    this.push('hub:onReady')
  },
  openQueue() {
    wx.navigateTo({
      url: '/package-flow/queue/index?from=hub',
    })
  },
  openInsights() {
    wx.navigateTo({
      url: '/pages/insights/index?from=hub',
    })
  },
  switchSettings() {
    wx.switchTab({
      url: '/pages/settings/index',
    })
  },
  relaunchQueue() {
    wx.reLaunch({
      url: '/package-flow/queue/index?from=relaunch',
    })
  },
})
