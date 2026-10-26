Page({
  data: {
    verticalPosition: 0,
    horizontalPosition: 0,
    contentHeight: 1000,
    contentWidth: 1000,
    lowerCount: 0,
    upperCount: 0,
    rightCount: 0,
    leftCount: 0,
    outerCount: 0,
    lowerDirection: '',
    upperDirection: '',
    rightDirection: '',
    leftDirection: '',
  },
  handleVerticalScroll(event: WechatMiniprogram.CustomEvent<{ scrollTop: number }>) {
    this.setData({ verticalPosition: event.detail.scrollTop })
  },
  handleHorizontalScroll(event: WechatMiniprogram.CustomEvent<{ scrollLeft: number }>) {
    this.setData({ horizontalPosition: event.detail.scrollLeft })
  },
  handleLower(event: WechatMiniprogram.CustomEvent<{ direction: string }>) {
    const lowerCount = this.data.lowerCount + 1
    this.setData({
      lowerCount,
      lowerDirection: event.detail.direction,
      contentHeight: this.data.contentHeight + (lowerCount <= 2 ? 100 : 0),
    })
  },
  handleUpper(event: WechatMiniprogram.CustomEvent<{ direction: string }>) {
    this.setData({ upperCount: this.data.upperCount + 1, upperDirection: event.detail.direction })
  },
  handleRight(event: WechatMiniprogram.CustomEvent<{ direction: string }>) {
    const rightCount = this.data.rightCount + 1
    this.setData({
      rightCount,
      rightDirection: event.detail.direction,
      contentWidth: this.data.contentWidth + (rightCount <= 2 ? 100 : 0),
    })
  },
  handleLeft(event: WechatMiniprogram.CustomEvent<{ direction: string }>) {
    this.setData({ leftCount: this.data.leftCount + 1, leftDirection: event.detail.direction })
  },
  handleOuterLower() {
    this.setData({ outerCount: this.data.outerCount + 1 })
  },
})
