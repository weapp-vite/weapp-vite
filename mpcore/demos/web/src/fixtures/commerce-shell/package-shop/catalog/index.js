Page({
  data: {
    title: 'Catalog',
    source: '',
    cards: [
      { id: 'sku-1', label: 'Orbit Lamp' },
      { id: 'sku-2', label: 'Atlas Chair' },
    ],
    logs: [],
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message],
    })
  },
  onLoad(query) {
    this.setData({
      source: query?.source ?? 'unknown',
    })
    this.push('catalog:onLoad:' + JSON.stringify(query))
  },
  onShow() {
    this.push('catalog:onShow')
  },
  onReady() {
    this.push('catalog:onReady')
  },
  onHide() {
    this.push('catalog:onHide')
  },
  onUnload() {
    this.push('catalog:onUnload')
  },
  openItem() {
    wx.navigateTo({
      url: '../item/index?sku=sku-2',
    })
  },
})
