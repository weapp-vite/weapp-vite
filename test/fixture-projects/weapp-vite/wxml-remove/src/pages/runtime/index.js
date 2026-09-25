Page({
  data: { label: 'legacy', eventCount: 0 },
  recordReady() {
    this.setData({ eventCount: this.data.eventCount + 1 })
  },
})
