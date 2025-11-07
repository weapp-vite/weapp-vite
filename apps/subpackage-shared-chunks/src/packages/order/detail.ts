import { AES } from 'crypto-es'

Page({
  data: {
    orderId: 'A20240401-001',
    status: '待发货',
    timeline: [],
  },
  async onLoad() {
    console.log('[order-detail] init', AES)
    const { test3 } = await import('@/action/test3')
    test3()
    this.setData({
      timeline: [
        { label: '下单', time: '10:01' },
        { label: '付款', time: '10:03' },
        { label: '待发货', time: '当前' },
      ],
    })
  },
  onContactCustomer() {
    wx.showToast({
      title: '已发送提醒',
      icon: 'success',
      duration: 600,
    })
  },
  onRefund() {
    wx.showModal({
      title: '退款确认',
      content: '是否为该订单发起退款？',
      success: (res) => {
        if (res.confirm) {
          import('@/action/test4').then(({ test4 }) => {
            test4()
            wx.showToast({
              title: '已提交退款',
              icon: 'success',
            })
          })
        }
      },
    })
  },
})
