export const chunkedRequestFiles: Array<[string, string]> = [
  ['app.json', JSON.stringify({ pages: ['pages/index'] })],
  ['app.js', 'App({})'],
  ['pages/index.js', `
    Page({
      data: { status: 'idle', bytes: [], events: [], removed: 0, result: null },
      record(event) { this.setData({ events: this.data.events.concat(event) }) },
      start(mode) {
        this.setData({ status: 'waiting' })
        this.task = wx.request({
          url: 'https://stream-fixture.invalid/data', enableChunked: true, responseType: 'arraybuffer',
          success: result => { this.record('success'); this.setData({ result: result.data }) },
          fail: error => { this.record('fail'); this.setData({ error: error.errMsg }) },
          complete: () => { this.record('complete'); this.setData({ status: 'completed' }) },
        })
        const removed = () => this.setData({ removed: this.data.removed + 1 })
        this.task.onHeadersReceived(removed)
        this.task.offHeadersReceived(removed)
        this.task.onHeadersReceived(() => this.record('headers'))
        this.task.onChunkReceived(removed)
        this.task.offChunkReceived(removed)
        this.task.onChunkReceived(({ data }) => {
          this.record('chunk')
          this.setData({ status: 'streaming', bytes: this.data.bytes.concat(Array.from(new Uint8Array(data))) })
          if (mode === 'abort') this.task.abort()
          if (mode === 'off') this.task.offChunkReceived()
        })
      },
      abort() { this.task.abort() },
    })
  `],
  ['pages/index.wxml', '<view id="status">{{status}}</view><view id="bytes">{{bytes.length}}</view><view id="events">{{events}}</view>'],
]
export function chunkedRequestMock() {
  return {
    url: 'https://stream-fixture.invalid/data',
    delay: 10,
    response: 'must not leak buffered body',
    header: { 'content-type': 'application/octet-stream' },
    chunks: [
      { data: new Uint8Array([0, 0xE4]).buffer, delay: 10 },
      { data: new Uint8Array([0xB8, 0xAD, 255]).buffer, delay: 10 },
    ],
  }
}
