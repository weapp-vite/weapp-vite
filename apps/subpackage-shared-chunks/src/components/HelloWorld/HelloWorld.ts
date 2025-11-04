
interface HelloWorldLink {
  text: string
  url: string
  variant?: 'ghost'
}

Component({
  properties: {
    title: {
      type: String,
      value: 'Hello weapp-vite',
    },
    description: {
      type: String,
      value: '欢迎使用 weapp-vite 模板。',
    },
    docs: {
      type: String,
      value: '',
    },
    links: {
      type: Array,
      value: [] as HelloWorldLink[],
    },
  },
  lifetimes: {
    attached() {
      if (!this.data.links?.length && this.data.docs) {
        this.setData({
          links: [
            {
              text: '复制文档链接',
              url: this.data.docs,
            },
          ],
        })
      }
    },
  },
  methods: {
    async copyLink(event: WechatMiniprogram.TouchEvent) {
      const url = event.currentTarget.dataset?.url as string | undefined
      if (!url) {
        return
      }

      try {
        await wx.setClipboardData({ data: url })
        wx.showToast({
          title: '链接已复制',
          icon: 'success',
          duration: 1500,
        })
      }
      catch (error) {
        console.error('复制链接失败', error)
      }
    },
  },
})
