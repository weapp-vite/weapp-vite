Page({
  data: {
    title: 'Mercury Market',
    hero: 'Fresh arrivals in a tab-driven mini-program shell.',
    feed: [
      { id: 'sku-1', name: 'Orbit Lamp', price: 129 },
      { id: 'sku-2', name: 'Atlas Chair', price: 349 },
      { id: 'sku-3', name: 'Signal Clock', price: 89 },
    ],
    logs: [],
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message],
    })
  },
  onLoad(query) {
    this.push('home:onLoad:' + JSON.stringify(query))
  },
  onShow() {
    this.push('home:onShow')
  },
  onReady() {
    this.push('home:onReady')
  },
  onHide() {
    this.push('home:onHide')
  },
  openCatalog() {
    wx.navigateTo({
      url: '/package-shop/catalog/index?source=home',
    })
  },
  openProfile() {
    wx.switchTab({
      url: '/pages/profile/index',
    })
  },
  pingScroll() {
    wx.pageScrollTo({
      scrollTop: 180,
      success: () => this.push('home:pageScrollTo:success'),
      complete: () => this.push('home:pageScrollTo:complete'),
    })
  },
  onPageScroll(options) {
    this.push('home:onPageScroll:' + JSON.stringify(options))
  },
})
