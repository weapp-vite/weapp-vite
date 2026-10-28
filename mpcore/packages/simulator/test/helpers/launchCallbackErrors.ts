const methods = ['reLaunch', 'redirectTo'] as const
const callbacks = ['success', 'complete', 'fail'] as const

export const launchCallbackErrorCases = methods.flatMap(method => callbacks.map(callback => ({ method, callback })))

export function createLaunchCallbackErrorFixture(method: typeof methods[number], callback: typeof callbacks[number]) {
  const failedNavigation = callback === 'fail'
  const targetPage = failedNavigation ? 'home' : 'login'
  const errorMessage = `${method} ${callback} callback failed`
  const expectedCallbacks = failedNavigation ? ['fail', 'complete'] : ['success', 'complete']
  const committedEvents = [
    'app:launch:start',
    'app:launch:end',
    'app:show',
    'home:load',
    'home:show',
    ...(failedNavigation ? [] : ['home:unload', 'login:load', 'login:show']),
    ...expectedCallbacks.map(name => `navigation:${name}`),
  ]
  const files: Array<[string, string]> = [
    ['project.config.json', JSON.stringify({ appid: 'wx1234567890abcdef', miniprogramRoot: '.' })],
    ['app.json', JSON.stringify({ pages: ['pages/home/index', 'pages/login/index'] })],
    ['app.js', `App({
  globalData: { events: [], callbacks: [], loads: [], launchCalls: 0 },
  onLaunch() {
    this.globalData.launchCalls++
    this.globalData.events.push('app:launch:start')
    this.globalData.callbackError = new Error(${JSON.stringify(errorMessage)})
    wx.${method}({
      url: ${JSON.stringify(failedNavigation ? '/pages/missing/index' : '/pages/login/index')},
      success: () => {
        this.globalData.callbacks.push('success')
        this.globalData.events.push('navigation:success')
        if (${JSON.stringify(callback)} === 'success') throw this.globalData.callbackError
      },
      fail: error => {
        this.globalData.navigationError = error
        this.globalData.callbacks.push('fail')
        this.globalData.events.push('navigation:fail')
        if (${JSON.stringify(callback)} === 'fail') throw this.globalData.callbackError
      },
      complete: () => {
        this.globalData.callbacks.push('complete')
        this.globalData.events.push('navigation:complete')
        if (${JSON.stringify(callback)} === 'complete') throw this.globalData.callbackError
      },
    })
    this.globalData.events.push('app:launch:end')
  },
  onShow() { this.globalData.events.push('app:show') },
})`],
  ]
  for (const page of ['home', 'login']) {
    files.push(
      [`pages/${page}/index.json`, '{}'],
      [`pages/${page}/index.js`, `Page({
  data: { callbackTrace: '', completeCalls: 0 },
  onLoad() {
    getApp().globalData.loads.push(${JSON.stringify(page)})
    getApp().globalData.events.push('${page}:load')
  },
  onShow() { getApp().globalData.events.push('${page}:show') },
  onReady() {
    const data = getApp().globalData
    data.events.push('${page}:ready')
    this.setData({
      callbackTrace: data.callbacks.join('|'),
      completeCalls: data.callbacks.filter(name => name === 'complete').length,
    })
  },
  onUnload() { getApp().globalData.events.push('${page}:unload') },
})`],
      [`pages/${page}/index.wxml`, `<view id="launch-callback-page">${page}</view>
<view id="launch-callback-trace">{{callbackTrace}}</view>
<view id="launch-callback-complete-count">{{completeCalls}}</view>`],
    )
  }
  return { files, targetPage, errorMessage, expectedCallbacks, committedEvents, readyEvent: `${targetPage}:ready` }
}
