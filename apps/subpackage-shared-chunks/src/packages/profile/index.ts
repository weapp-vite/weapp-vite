import { AES } from 'crypto-es'

Page({
  data: {
    profile: {
      name: '夏沫',
      level: '钻石会员',
      city: '上海',
    },
    entries: [
      { label: '个人信息', url: '/packages/profile/settings' },
      { label: '订单记录', url: '/packages/order/index' },
      { label: '营销权益', url: '/packages/marketing/poster' },
    ],
  },
  onLoad() {
    console.log('[profile-index] ready', AES)
  },
  onNavigate(event: WechatMiniprogram.TouchEvent) {
    const { url } = event.currentTarget.dataset as { url?: string }
    if (url) {
      wx.navigateTo({ url })
    }
  },
})
