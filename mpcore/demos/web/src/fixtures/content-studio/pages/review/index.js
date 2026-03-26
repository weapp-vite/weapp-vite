Page({
  data: {
    title: 'Review Queue',
    from: '',
    logs: [],
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message],
    })
  },
  onLoad(query) {
    this.setData({ from: query?.from ?? 'unknown' })
    this.push('review:onLoad:' + JSON.stringify(query))
  },
  onShow() {
    this.push('review:onShow')
  },
})
