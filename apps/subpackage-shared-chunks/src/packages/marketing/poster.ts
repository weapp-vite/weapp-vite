import { AES } from 'crypto-es'
import { test2 } from '@/action/test2'
import { test3 } from '@/action/test3'
import { test4 } from '@/action/test4'

Page({
  data: {
    campaign: {
      title: '会员日海报',
      desc: '点击生成带有专属二维码的促销海报，便于在线传播。',
    },
  },
  onLoad() {
    console.log('[marketing-poster] init', AES)
  },
  onGeneratePoster() {
    test2()
    test3()
    test4()
    wx.showToast({
      title: '海报生成成功',
      icon: 'success',
    })
  },
})
