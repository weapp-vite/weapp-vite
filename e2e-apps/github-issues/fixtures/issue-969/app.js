App({
  globalData: { loads: [], events: [], launchCalls: 0 },
  onLaunch() {
    this.globalData.launchCalls++
    this.globalData.events.push('app:launch:start')
    wx.reLaunch({
      url: '/pages/login/index',
      success: () => this.globalData.events.push('redirect:success'),
      complete: () => this.globalData.events.push('redirect:complete'),
    })
    this.globalData.events.push('app:launch:end')
  },
  onShow() { this.globalData.events.push('app:show') },
})
