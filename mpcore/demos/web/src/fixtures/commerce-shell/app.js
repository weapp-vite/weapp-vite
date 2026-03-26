App({
  globalData: {
    timeline: [],
  },
  push(message) {
    this.globalData.timeline.push(message)
  },
  onLaunch(options) {
    this.push('app:onLaunch:' + JSON.stringify(options))
  },
  onShow(options) {
    this.push('app:onShow:' + JSON.stringify(options))
  },
  onPageNotFound(options) {
    this.push('app:onPageNotFound:' + JSON.stringify(options))
  },
})
