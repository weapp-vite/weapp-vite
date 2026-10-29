Page({
  data: { status: 'issue1278-ready', count: 0 },
  increment() {
    this.setData({ count: this.data.count + 1 })
    return this.data.count
  },
})
