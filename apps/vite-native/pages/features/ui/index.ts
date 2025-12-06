import Toast from '@vant/weapp/toast/toast'
import { formatTime } from '@/utils/util'

Page({
  data: {
    palette: ['#38bdf8', '#a855f7', '#22c55e', '#f97316', '#f43f5e'],
    badges: ['Tailwind utility-first', 'TDesign/Vant 组件', 'SVG 雪碧图', '自定义 tabbar'],
    tip: '',
  },

  handleToast() {
    Toast('已通过 Vant Toast 展示提示')
    this.setData({ tip: `操作时间：${formatTime(new Date())}` })
  },

  handlePaletteTap(event: WechatMiniprogram.TouchEvent) {
    const { color } = event.currentTarget.dataset as { color: string }
    wx.setClipboardData({ data: color })
    this.setData({ tip: `已复制色值 ${color}` })
  },
})
