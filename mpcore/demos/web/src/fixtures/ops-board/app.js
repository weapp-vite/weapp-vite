App({
  globalData: {
    timeline: [],
  },
  log(message) {
    this.globalData.timeline.push(message)
  },
  onLaunch(options) {
    this.log('ops:onLaunch:' + JSON.stringify(options))
  },
})
