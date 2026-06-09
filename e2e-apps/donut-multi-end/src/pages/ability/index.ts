Page({
  data: {
    lastAction: 'idle',
    capabilityRows: [
      { title: '剪贴板', note: 'wx.setClipboardData' },
      { title: '分享菜单', note: 'wx.showShareMenu' },
      { title: '页面导航', note: 'navigateTo / reLaunch' },
    ],
  },
  copyToken() {
    wx.setClipboardData({
      data: 'donut-multi-end',
      success: () => {
        this.setData({ lastAction: 'clipboard' })
      },
    })
  },
  enableShare() {
    wx.showShareMenu({
      withShareTicket: true,
      complete: () => {
        this.setData({ lastAction: 'share-menu' })
      },
    })
  },
  openProfile() {
    wx.navigateTo({
      url: '/pages/profile/index?from=ability',
    })
  },
})
