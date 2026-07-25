Page({
  data: {
    movableX: 18,
    movableY: 18,
    coverEvent: '等待点击',
    moveEvent: '18, 18',
    axisEvent: '等待拖拽',
  },
  handleCoverTap() {
    this.setData({ coverEvent: 'cover-view: tap' })
  },
  handleMove(event: WechatMiniprogram.CustomEvent<{ x: number, y: number }>) {
    this.setData({
      movableX: event.detail.x,
      movableY: event.detail.y,
      moveEvent: `${Math.round(event.detail.x)}, ${Math.round(event.detail.y)}`,
    })
  },
  handleHorizontalMove(event: WechatMiniprogram.CustomEvent<{ x: number, y: number }>) {
    this.setData({ axisEvent: `horizontal: ${Math.round(event.detail.x)}, ${Math.round(event.detail.y)}` })
  },
  handleVerticalMove(event: WechatMiniprogram.CustomEvent<{ x: number, y: number }>) {
    this.setData({ axisEvent: `vertical: ${Math.round(event.detail.x)}, ${Math.round(event.detail.y)}` })
  },
})
