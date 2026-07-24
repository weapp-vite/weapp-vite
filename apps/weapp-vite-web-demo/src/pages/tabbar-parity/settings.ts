Page({
  data: {
    loadCount: 0,
    showCount: 0,
  },
  onLoad() {
    this.setData({ loadCount: this.data.loadCount + 1 })
  },
  onShow() {
    this.setData({ showCount: this.data.showCount + 1 })
  },
})
