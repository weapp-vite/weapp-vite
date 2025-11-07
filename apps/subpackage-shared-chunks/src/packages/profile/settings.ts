import { AES } from 'crypto-es'
import { test2 } from '@/action/test2'
import { test3 } from '@/action/test3'
import { test4 } from '@/action/test4'

Page({
  data: {
    settings: {
      push: true,
      marketing: false,
      nightMode: false,
    },
  },
  onLoad() {
    console.log('[profile-settings] ready', AES)
  },
  onToggle(event: WechatMiniprogram.SwitchChange) {
    const { key } = event.currentTarget.dataset as { key: 'push' | 'marketing' | 'nightMode' }
    this.setData({
      [`settings.${key}`]: event.detail.value,
    })
  },
  onSave() {
    test2()
    test3()
    test4()
    wx.showToast({
      title: '设置已保存',
      icon: 'success',
    })
  },
})
