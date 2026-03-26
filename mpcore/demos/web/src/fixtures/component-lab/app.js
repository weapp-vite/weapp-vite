App({
  globalData: {
    timeline: []
  },
  push(message) {
    this.globalData.timeline.push(message)
  },
  onLaunch(options) {
    this.push('component-lab:onLaunch:' + JSON.stringify(options))
  }
})
