Page({
  data: {
    loadCount: 0,
    showCount: 0,
    lastEvent: 'ready',
  },
  onLoad() {
    this.setData({ loadCount: this.data.loadCount + 1 })
  },
  onShow() {
    this.setData({ showCount: this.data.showCount + 1 })
  },
  setBadge() {
    wx.setTabBarBadge({ index: 1, text: '8' })
    this.setData({ lastEvent: 'badge:8' })
  },
  showRedDot() {
    wx.showTabBarRedDot({ index: 1 })
    this.setData({ lastEvent: 'red-dot:on' })
  },
  toggleTabBar() {
    wx.hideTabBar({ animation: true })
    setTimeout(() => wx.showTabBar({ animation: true }), 120)
    this.setData({ lastEvent: 'visibility:toggled' })
  },
})
