import init from '../../assets/add.wasm?init'

Page({
  data: { status: 'ready', value: 'none' },
  async run() {
    this.setData({ status: 'loading' })
    const instance = await init({})
    const value = instance.exports.add(20, 22)
    this.setData({ status: 'loaded', value: String(value) })
    return { value }
  },
  async runWorker() {
    const worker = wx.createWorker('workers/index.js')
    try {
      return await new Promise<{ value: number }>((resolve, reject) => {
        worker.onMessage((result: { value: number }) => resolve(result))
        worker.onError(reject)
        worker.postMessage({ left: 20, right: 22 })
      })
    }
    finally {
      worker.terminate()
    }
  },
})
