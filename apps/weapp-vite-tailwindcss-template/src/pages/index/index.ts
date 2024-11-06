import { hello } from '@/utils/util'

Page({
  data: {
    mode: 'light',
  },
  switchMode() {
    if (this.data.mode === 'light') {
      this.setData({
        mode: 'dark',
      })
    }
    else {
      this.setData({
        mode: 'light',
      })
    }
  },
  async copy(e: WechatMiniprogram.BaseEvent) {
    if (e.mark?.url) {
      await wx.setClipboardData({
        data: e.mark.url,
      })
      console.log(`复制成功: ${e.mark.url}`)
    }
  },
  onLoad() {
    console.log(hello())
  },
})
