const nativeMarker = 'STATEFUL-NATIVE-BASE'

interface NavigationTrace {
  redirectAt: string
  events: string[]
}

function recordNavigation(name: string) {
  const trace = getApp().globalData?.navigationTrace as NavigationTrace | undefined
  if (!trace) {
    return
  }
  trace.events.push(name)
  if (trace.redirectAt === name) {
    const request: WechatMiniprogram.RedirectToOption = {
      url: '/pages/component/index?source=e2e',
      success: () => trace.events.push('success'),
      fail: error => trace.events.push(`fail:${error.errMsg ?? String(error)}`),
      complete: () => trace.events.push('complete'),
    }
    wx.redirectTo(request)
    request.url = '/pages/native/index?source=mutated'
    trace.events.push('returned')
  }
}

Page({
  onLoad(query) {
    const app = getApp()
    app.globalData ??= {}
    app.globalData.navigationTrace = query.redirectAt
      ? { redirectAt: query.redirectAt, events: [] }
      : undefined
    recordNavigation('load')
  },
  onShow() { recordNavigation('show') },
  onReady() { recordNavigation('ready') },
  onHide() { recordNavigation('hide') },
  onUnload() { recordNavigation('unload') },
  onRouteDone() { recordNavigation('routeDone') },
  data: {
    count: 0,
    input: '',
    marker: nativeMarker,
  },
  increment() {
    this.setData({ count: this.data.count + 1 })
  },
  onInput(event: WechatMiniprogram.Input) {
    this.setData({ input: event.detail.value })
  },
})
