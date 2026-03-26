Page({
  data: {
    title: 'Item Detail',
    sku: '',
    status: 'ready',
    logs: [],
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message],
    })
  },
  onLoad(query) {
    this.setData({
      sku: query?.sku ?? '',
    })
    this.push('item:onLoad:' + JSON.stringify(query))
  },
  onShow() {
    this.push('item:onShow')
  },
  onReady() {
    this.push('item:onReady')
  },
  onUnload() {
    this.push('item:onUnload')
  },
  backToCatalog() {
    wx.navigateBack({
      delta: 1,
    })
  },
  jumpHomeTab() {
    wx.switchTab({
      url: '/pages/home/index',
    })
  },
  relaunchCatalog() {
    wx.reLaunch({
      url: '/package-shop/catalog/index?source=item-relaunch',
    })
  },
})
