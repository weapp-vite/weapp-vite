Page({
  data: {
    entries: [
      { label: '订单中心', url: '/packages/order/index' },
      { label: '个人中心', url: '/packages/profile/index' },
      { label: '营销活动', url: '/packages/marketing/poster' },
    ],
  },
  onLoad() {
    wx.preloadSubpackage({
      name: 'packages/profile',
      success() {
        console.log('[index] preload profile success')
      },
    })
    wx.preloadSubpackage({
      name: 'packages/order',
      network: 'all',
    })
  },
  onNavigate(event: WechatMiniprogram.TouchEvent) {
    const { url } = event.currentTarget.dataset as { url?: string }
    if (url) {
      wx.navigateTo({ url })
    }
  },
})
