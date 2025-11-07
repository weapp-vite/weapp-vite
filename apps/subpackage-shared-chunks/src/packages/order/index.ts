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
    metrics: [
      { label: '待发货', value: '28', trend: -3 },
      { label: '待支付', value: '12', trend: 5 },
      { label: '售后中', value: '4', trend: 2 },
      { label: '今日 GMV', value: '￥128k', trend: 8 },
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
  onRefreshMetrics() {
    wx.showToast({
      title: '指标已刷新',
      icon: 'success',
      duration: 600,
    })
  },
})
