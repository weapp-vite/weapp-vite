export const requestMockFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ appid: 'wx123', miniprogramRoot: '.' })],
  ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['app.js', 'App({})'],
  ['pages/index/index.js', `
Page({
  data: { status: 'idle', result: '', httpStatus: 0, error: '', callbacks: [], socket: '' },
  onLoad() {
    this.setData({ socket: typeof wx.connectSocket + ':' + wx.canIUse('connectSocket') })
  },
  record(callback) {
    this.setData({ callbacks: this.data.callbacks.concat(callback) })
  },
  request() {
    this.setData({ status: 'pending', result: '', httpStatus: 0, error: '', callbacks: [] })
    try {
      this.task = wx.request({
        url: 'https://request-fixture.invalid/graphql',
        method: 'POST',
        header: { 'content-type': 'application/json', 'x-client': 'fixture' },
        data: { operationName: 'Dashboard', variables: { section: 'overview' } },
        success: (response) => {
          this.setData({ status: 'success', result: response.data.message, httpStatus: response.statusCode })
          this.record('success')
        },
        fail: (error) => {
          this.setData({ status: 'error', error: error.message })
          this.record('fail')
        },
        complete: () => this.record('complete'),
      })
    }
    catch (error) {
      this.setData({ status: 'error', error: error.message })
    }
  },
  abort() {
    this.task.abort()
  },
})
`],
  ['pages/index/index.wxml', `
<view id="request-status">{{status}}</view>
<view id="request-pending" wx:if="{{status === 'pending'}}">Waiting for response</view>
<view id="request-result" wx:if="{{status === 'success'}}">{{result}}</view>
<view id="request-http-status" wx:if="{{status === 'success'}}">{{httpStatus}}</view>
<view id="request-error" wx:if="{{status === 'error'}}">{{error}}</view>
<view class="request-callback" wx:for="{{callbacks}}" wx:key="*this">{{item}}</view>
<view id="socket-capability">{{socket}}</view>
`],
]

export const requestResponseMock = {
  delay: 30,
  method: 'POST',
  response: { message: 'Dashboard ready' },
  statusCode: 201,
  url: 'https://request-fixture.invalid/graphql',
}
