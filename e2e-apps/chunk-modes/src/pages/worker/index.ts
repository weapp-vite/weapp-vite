let activeWorker: WechatMiniprogram.Worker | undefined
Page({
  data: { message: 'waiting', count: 0 },
  onLoad() {
    activeWorker = wx.createWorker('workers/messages/index.js')
    activeWorker.onMessage((value) => {
      this.setData({ message: value.message, count: value.count })
    })
  },
  send() {
    const value = { message: 'echo' }
    activeWorker?.postMessage(value)
    value.message = 'mutated'
  },
  onUnload() {
    activeWorker?.terminate()
    activeWorker = undefined
  },
})
