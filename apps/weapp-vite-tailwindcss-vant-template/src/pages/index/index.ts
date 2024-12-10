import { hello } from '@/utils/util'
import Dialog from '@vant/weapp/dialog/dialog'

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
  showDialog() {
    Dialog.alert({
      title: '我来自Vant',
      message: '我是Dialog',
    }).then(() => {
      // on close
    })
  },
  onLoad() {
    console.log(hello())
  },
})
