const action = require('@/action/test2')
import { isDevTools } from '@/config'
import { test1 } from '@/action/test1'
import { AES } from 'crypto-es'

Page({
  data: {
    overview: {
      title: '今日订单',
      desc: '关注待发货与退款中的订单，及时处理异常。',
    },
    shortcuts: [
      { text: '创建订单', handler: 'onCreateOrder' },
      { text: '同步 ERP', handler: 'onSyncErp' },
    ],
  },
  onReady() {
    console.log('[order-index] ready', AES, isDevTools)
  },
  onCreateOrder() {
    action.test2()
    test1()
    wx.navigateTo({
      url: '/packages/order/detail',
    })
  },
  onSyncErp() {
    wx.showToast({
      title: 'ERP 同步中',
      icon: 'loading',
      duration: 800,
    })
  },
})
