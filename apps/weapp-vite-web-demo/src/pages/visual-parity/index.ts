Page({
  data: {
    inputValue: 'weapp-vite',
    inputEvent: '等待输入',
    scrollEvent: '0, 0',
  },
  handleInput(event: WechatMiniprogram.Input) {
    this.setData({
      inputValue: event.detail.value,
      inputEvent: `input: ${event.detail.value}`,
    })
  },
  handleFocus() {
    this.setData({ inputEvent: 'focus' })
  },
  handleBlur() {
    this.setData({ inputEvent: 'blur' })
  },
  handleConfirm(event: WechatMiniprogram.Input) {
    this.setData({ inputEvent: `confirm: ${event.detail.value}` })
  },
  handleScroll(event: WechatMiniprogram.CustomEvent<{
    scrollLeft: number
    scrollTop: number
  }>) {
    this.setData({
      scrollEvent: `${Math.round(event.detail.scrollLeft)}, ${Math.round(event.detail.scrollTop)}`,
    })
  },
  handleButtonTap() {
    this.setData({ inputEvent: 'button: tap' })
  },
})
