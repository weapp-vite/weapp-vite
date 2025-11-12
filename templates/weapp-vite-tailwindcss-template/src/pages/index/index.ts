import { hello } from '@/utils/util'

Page({
  data: {
    mode: 'light',
    hello: {
      title: 'Hello weapp-vite',
      description: '这是一个集成 Tailwind CSS 的小程序模板，开箱即可体验原子化样式与完整的 HMR 流程。',
      docs: 'https://vite.icebreaker.top',
      links: [
        {
          text: '复制文档链接',
          url: 'https://vite.icebreaker.top',
        },
        {
          text: 'Tailwind Demo',
          url: 'https://tw.icebreaker.top',
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
  onLoad() {
    // eslint-disable-next-line no-console
    console.log(hello())
  },
})
