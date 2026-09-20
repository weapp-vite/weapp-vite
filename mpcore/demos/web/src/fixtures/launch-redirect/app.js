App({
  globalData: { loads: [], launchCalls: 0 },
  onLaunch() {
    this.globalData.launchCalls++
    wx.reLaunch({ url: '/pages/login/index?from=launch' })
  },
})
