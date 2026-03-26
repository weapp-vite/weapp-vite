App({
  globalData: {
    timeline: [],
  },
  push(message) {
    this.globalData.timeline.push(message)
  },
  onLaunch(options) {
    this.push('studio:onLaunch:' + JSON.stringify(options))
  },
  onPageNotFound(options) {
    this.push('studio:onPageNotFound:' + JSON.stringify(options))
  },
})
