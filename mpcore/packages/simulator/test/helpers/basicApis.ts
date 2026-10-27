export function basicApisFiles(): Array<[string, string]> {
  return [
    ['project.config.json', JSON.stringify({ appid: 'wx-basic-apis', miniprogramRoot: '.' })],
    ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
    ['app.js', 'App({})'],
    ['pages/index/index.json', '{}'],
    ['pages/index/index.js', `
Page({
  data: { callbacks: [], results: [], status: 'idle', code: '', error: '' },
  onLoad() {
    const names = ['login', 'getAccountInfoSync', 'arrayBufferToBase64', 'base64ToArrayBuffer']
    this.setData({ methods: names.map(name => typeof wx[name]), capable: names.every(name => wx.canIUse(name)) })
  },
  readBasics() {
    const encoded = wx.arrayBufferToBase64(new Uint8Array([0, 127, 128, 255]).buffer)
    const decoded = Array.from(new Uint8Array(wx.base64ToArrayBuffer(encoded)))
    this.setData({ account: wx.getAccountInfoSync(), encoded, decoded })
  },
  account() { return wx.getAccountInfoSync() },
  encode(values) { return wx.arrayBufferToBase64(new Uint8Array(values).buffer) },
  decode(value) { return Array.from(new Uint8Array(wx.base64ToArrayBuffer(value))) },
  login(options) {
    const returned = wx.login({
      timeout: options && options.timeout,
      success: result => {
        this.record('success', result)
        if (options && options.throwOnSuccess) throw new Error('login callback failed')
      },
      fail: result => this.record('fail', result),
      complete: result => this.record('complete', result),
    })
    this.setData({ loginReturn: typeof returned })
  },
  mutateLoginCallbacks() {
    const option = {
      success: result => this.record('success', result),
      complete: result => this.record('complete', result),
    }
    wx.login(option)
    option.success = result => this.record('unexpected', result)
  },
  record(kind, result) {
    this.setData({
      callbacks: this.data.callbacks.concat(kind),
      results: this.data.results.concat(result),
      ...(kind === 'success' ? { status: 'success', code: result.code } : {}),
      ...(kind === 'fail' ? { status: 'error', error: result.errMsg } : {}),
    })
  },
})
`],
    ['pages/index/index.wxml', `
<view id="api-capability">{{capable}}</view>
<view id="account-id">{{account.miniProgram.appId}}</view>
<view id="account-env">{{account.miniProgram.envVersion}}</view>
<view id="base64-encoded">{{encoded}}</view>
<view id="base64-decoded">{{decoded}}</view>
<view id="login-status">{{status}}</view>
<view id="login-code">{{code}}</view>
<view id="login-error">{{error}}</view>
<view wx:for="{{callbacks}}" wx:key="index" class="login-callback">{{item}}</view>
`],
  ]
}
