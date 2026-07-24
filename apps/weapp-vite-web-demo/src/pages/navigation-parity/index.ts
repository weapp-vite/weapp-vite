const ITEM_COUNT = 3

Page({
  data: {
    current: 1,
    eventSource: 'idle',
    animationCount: 0,
  },
  handleSwiperChange(event: WechatMiniprogram.SwiperChange) {
    this.setData({
      current: event.detail.current,
      eventSource: event.detail.source || 'programmatic',
    })
  },
  handleAnimationFinish() {
    this.setData({
      animationCount: this.data.animationCount + 1,
    })
  },
  stepSwiper(event: WechatMiniprogram.TouchEvent) {
    const direction = Number(event.currentTarget.dataset.direction)
    const next = (this.data.current + direction + ITEM_COUNT) % ITEM_COUNT
    this.setData({ current: next })
  },
})
