Page({
  data: { count: 0, label: 'initial', visible: true },
  increment() {
    this.setData({ count: this.data.count + 1, label: 'updated' })
  },
  toggle() {
    this.setData({ visible: !this.data.visible })
  },
})
