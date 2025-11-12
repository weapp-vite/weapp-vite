import Dialog from '@vant/weapp/dialog/dialog'
import { hello } from '@/utils/util'

Page({
  data: {
    mode: 'light',
    hello: {
      title: 'Hello weapp-vite + Vant',
      description: '基于 weapp-vite 与 Tailwind CSS，并预先集成了 Vant Weapp 组件库，助你快速搭建业务界面。',
      docs: 'https://vite.icebreaker.top',
      links: [
        {
          text: '复制文档链接',
          url: 'https://vite.icebreaker.top',
        },
        {
          text: 'Vant 组件手册',
          url: 'https://vant-contrib.gitee.io/vant-weapp/#/home',
          variant: 'ghost',
        },
      ],
    },
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
      // eslint-disable-next-line no-console
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
    // eslint-disable-next-line no-console
    console.log(hello())
  },
})
