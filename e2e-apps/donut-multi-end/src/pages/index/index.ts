Page({
  data: {
    __e2eResult: {
      status: 'ready',
      projectArchitecture: 'multiPlatform',
      entry: 'index',
    },
  },
  openProfile() {
    wx.navigateTo({
      url: '/pages/profile/index?from=index',
    })
  },
})
