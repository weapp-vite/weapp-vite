Page({
  data: {
    heroCard: {
      title: 'weapp-vite 分包最佳实践',
      description: '演示主包预加载、独立分包与共享样式注入策略。',
      docs: 'https://vite.icebreaker.top/config/subpackages.html',
      links: [
        {
          text: '查看分包指南',
          url: 'https://vite.icebreaker.top/config/subpackages.html',
        },
        {
          text: 'GitHub 示例',
          url: 'https://github.com/weapp-vite/weapp-vite/tree/main/apps/subpackage-shared-chunks',
          variant: 'ghost',
        },
      ],
    },
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
