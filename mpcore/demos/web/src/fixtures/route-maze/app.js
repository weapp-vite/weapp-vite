const timeline = []
const showListener = options => timeline.push('maze:wx:onAppShow:' + JSON.stringify(options))
const hideListener = options => timeline.push('maze:wx:onAppHide:' + JSON.stringify(options))

wx.onAppShow(showListener)
wx.onAppShow(showListener)
wx.onAppHide(hideListener)
wx.onAppHide(hideListener)

App({
  globalData: {
    timeline,
  },
  log(message) {
    this.globalData.timeline.push(message)
  },
  removeAppLifecycleListeners() {
    wx.offAppShow(showListener)
    wx.offAppHide(hideListener)
  },
  onLaunch(options) {
    this.log('maze:onLaunch:' + JSON.stringify(options))
  },
  onShow(options) {
    this.log('maze:onShow:' + JSON.stringify(options))
  },
  onHide(options) {
    this.log('maze:onHide:' + JSON.stringify(options))
  },
  onPageNotFound(options) {
    this.log('maze:onPageNotFound:' + JSON.stringify(options))
  },
})
