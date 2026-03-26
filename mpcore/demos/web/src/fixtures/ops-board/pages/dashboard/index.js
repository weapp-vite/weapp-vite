Page({
  data: {
    title: 'Ops Dashboard',
    widgets: [
      { key: 'queue', value: 14 },
      { key: 'alerts', value: 3 },
      { key: 'latency', value: 248 },
    ],
    filters: {
      owner: 'core',
      keyword: 'latency',
    },
    logs: [],
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message],
    })
  },
  onLoad(query) {
    this.push('dashboard:onLoad:' + JSON.stringify(query))
  },
  onReady() {
    this.push('dashboard:onReady')
  },
  openSettings() {
    wx.redirectTo({
      url: '/pages/settings/index?section=alerts',
    })
  },
  patchLatency() {
    this.setData({
      'widgets[2].value': 132,
    }, () => {
      this.push('dashboard:setData:complete')
    })
  },
  updateKeyword() {
    this.setData({
      'filters.keyword': 'incident',
    }, () => {
      this.push('dashboard:filters:incident')
    })
  },
  triggerMissingRoute() {
    wx.navigateTo({
      url: '/pages/ghost/index?source=dashboard',
      fail: (error) => this.push('dashboard:missing:' + error.message),
      complete: () => this.push('dashboard:missing:complete'),
    })
  },
})
