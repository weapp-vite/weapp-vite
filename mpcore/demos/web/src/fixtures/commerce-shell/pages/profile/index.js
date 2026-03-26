Page({
  data: {
    title: 'Profile',
    summary: 'Tab page with stable cache semantics.',
    logs: [],
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message],
    })
  },
  onLoad(query) {
    this.push('profile:onLoad:' + JSON.stringify(query))
  },
  onShow() {
    this.push('profile:onShow')
  },
  onReady() {
    this.push('profile:onReady')
  },
  onHide() {
    this.push('profile:onHide')
  },
  onTabItemTap(options) {
    this.push('profile:onTabItemTap:' + JSON.stringify(options))
  },
  openCatalog() {
    wx.navigateTo({
      url: '/package-shop/catalog/index?source=profile',
    })
  },
})
