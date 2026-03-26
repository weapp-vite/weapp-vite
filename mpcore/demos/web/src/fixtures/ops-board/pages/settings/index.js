Page({
  data: {
    title: 'Settings',
    section: '',
    logs: [],
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message],
    })
  },
  onLoad(query) {
    this.setData({
      section: query?.section ?? '',
    })
    this.push('settings:onLoad:' + JSON.stringify(query))
  },
  onShow() {
    this.push('settings:onShow')
  },
})
