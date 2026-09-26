export function logManagerFiles(level?: number): Array<[string, string]> {
  return [
    ['project.config.json', JSON.stringify({ appid: 'wx123', miniprogramRoot: '.' })],
    ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
    ['app.js', 'App({})'],
    ['pages/index/index.js', `
Page({
  data: { state: 'pending' },
  onLoad() {
    const manager = wx.getLogManager(${level === undefined ? '' : JSON.stringify({ level })})
    const results = ['debug', 'info', 'log', 'warn'].map(method => manager[method]('probe:' + method, { level: 'payload' }))
    this.setData({
      state: typeof manager.then === 'undefined' && results.every(value => value === undefined) ? 'sync:void' : 'invalid',
      capable: wx.canIUse('getLogManager') && wx.canIUse('getLogManager.return.debug'),
    })
  },
})
`],
    ['pages/index/index.wxml', '<view id="log-state">{{state}}</view><view id="log-capability">{{capable}}</view>'],
  ]
}
