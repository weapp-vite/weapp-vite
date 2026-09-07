// 模拟编译后原生页面的延迟挂载边界；真实 guard 决策由 Wevu owning tests 和 IDE 场景验证。
export const deferredMountFiles: Array<[string, string]> = [
  ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['app.js', 'App({ globalData: { events: [] } })'],
  ['pages/index/index.js', `
Page({
  data: { mountedTrace: 'pending' },
  onLoad() {
    const events = getApp().globalData.events
    events.push('guard:start')
    this.mountTask = new Promise((resolve, reject) => {
      this.resolveGuard = resolve
      this.rejectGuard = reject
    }).then((allowed) => {
      if (!allowed) return
      events.push('mounted')
      this.setData({ mountedTrace: events.join(' > ') })
    }, () => {})
  },
  completeGuard(outcome) {
    getApp().globalData.events.push('guard:done')
    if (outcome === 'reject') this.rejectGuard(new Error('guard rejected'))
    else this.resolveGuard(outcome === 'allow')
    return this.mountTask
  },
})
`],
  ['pages/index/index.wxml', '<view><text id="guard-title">async guard</text><text id="mounted-trace">{{mountedTrace}}</text></view>'],
]
