Page({
  onLoad(query) {
    getApp().globalData.loads.push('login')
    this.setData({ from: query.from })
  },
})
