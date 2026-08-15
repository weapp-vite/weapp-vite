Page({
  data: {
    platform: import.meta.env.PLATFORM,
    status: 'ready',
    count: 0,
  },
  increment() {
    this.setData({
      count: this.data.count + 1,
    })
  },
})
