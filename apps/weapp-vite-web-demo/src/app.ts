const lifecycleState = {
  launchCount: 0,
  showCount: 0,
  hideCount: 0,
  lastShowPath: '',
  events: [] as string[],
}

App({
  globalData: {
    lifecycle: lifecycleState,
  },
  onLaunch(options) {
    lifecycleState.launchCount += 1
    lifecycleState.events.push(`launch:${options.path}`)
  },
  onShow(options) {
    lifecycleState.showCount += 1
    lifecycleState.lastShowPath = options.path
    lifecycleState.events.push(`show:${options.path}`)
  },
  onHide() {
    lifecycleState.hideCount += 1
    lifecycleState.events.push('hide')
  },
})
