Page({
  data: {
    title: 'Asset Detail',
    id: '',
    logs: [],
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message],
    })
  },
  onLoad(query) {
    this.setData({ id: query?.id ?? '' })
    this.push('asset:onLoad:' + JSON.stringify(query))
  },
  onShow() {
    this.push('asset:onShow')
  },
})
