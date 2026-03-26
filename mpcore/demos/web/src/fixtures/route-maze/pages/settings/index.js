Page({
  data: {
    title: 'Settings Tab',
    logs: [],
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message],
    })
  },
  onLoad(query) {
    this.push('settings-tab:onLoad:' + JSON.stringify(query))
  },
  onShow() {
    this.push('settings-tab:onShow')
  },
  onTabItemTap(options) {
    this.push('settings-tab:onTabItemTap:' + JSON.stringify(options))
  },
  backHub() {
    wx.switchTab({
      url: '/pages/hub/index',
    })
  },
})
