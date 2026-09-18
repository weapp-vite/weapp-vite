Page({
  onLoad() {
    getApp().globalData.loads.push('login')
    getApp().globalData.events.push('login:load')
  },
  onShow() { getApp().globalData.events.push('login:show') },
  onReady() { getApp().globalData.events.push('login:ready') },
  onUnload() { getApp().globalData.events.push('login:unload') },
})
