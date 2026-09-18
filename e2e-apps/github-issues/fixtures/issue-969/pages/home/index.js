Page({
  onLoad() {
    getApp().globalData.loads.push('home')
    getApp().globalData.events.push('home:load')
  },
  onShow() { getApp().globalData.events.push('home:show') },
  onReady() { getApp().globalData.events.push('home:ready') },
  onUnload() { getApp().globalData.events.push('home:unload') },
})
