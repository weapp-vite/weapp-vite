const custom = {
  at() {
    return 'custom-at'
  },
  replaceAll() {
    return 'custom-replace'
  },
}
Page({
  data: { result: custom.at(), count: 0 },
  increment() { this.setData({ count: this.data.count + 1, result: custom.replaceAll() }) },
})
