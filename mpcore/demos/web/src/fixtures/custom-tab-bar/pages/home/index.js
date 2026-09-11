Page({
  onShow() {
    this.getTabBar().setData({ owner: 'home' })
  },
  openDetail() {
    wx.navigateTo({ url: '/pages/detail/index' })
  },
})
