App({
  globalData: {
    timeline: [],
  },
  log(message) {
    this.globalData.timeline.push(message)
  },
  onLaunch(options) {
    this.log('maze:onLaunch:' + JSON.stringify(options))
  },
  onShow(options) {
    this.log('maze:onShow:' + JSON.stringify(options))
  },
  onPageNotFound(options) {
    this.log('maze:onPageNotFound:' + JSON.stringify(options))
  },
})
