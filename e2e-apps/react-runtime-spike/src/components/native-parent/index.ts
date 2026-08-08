Component({
  data: {
    reactResult: 'idle',
    wevuResult: 'idle',
  },
  methods: {
    onReactChange(event: WechatMiniprogram.CustomEvent<{ value: number }>) {
      this.setData({ reactResult: `react:${event.detail.value}` })
    },
    onWevuChange(event: WechatMiniprogram.CustomEvent<{ value: number }>) {
      this.setData({ wevuResult: `wevu:${event.detail.value}` })
    },
  },
})
