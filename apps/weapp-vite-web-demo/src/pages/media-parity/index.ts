Page({
  data: {
    canvasStatus: '等待绘制',
    videoEvent: '等待事件',
    videoTime: '0.0 / 0.0',
    videoBuffered: '0%',
  },
  onReady() {
    const context = wx.createCanvasContext('mediaCanvas')
    context.setFillStyle('#0b7f5b')
    context.fillRect(18, 18, 116, 64)
    context.setFillStyle('#17212b')
    context.fillRect(148, 18, 134, 64)
    context.beginPath()
    context.arc(66, 116, 24, 0, Math.PI * 2)
    context.setFillStyle('#f4b942')
    context.fill()
    context.setStrokeStyle('#ffffff')
    context.setLineWidth(4)
    context.beginPath()
    context.moveTo(112, 116)
    context.lineTo(274, 116)
    context.stroke()
    context.setFillStyle('#ffffff')
    context.setFontSize(16)
    context.fillText('WEAPP / WEB', 156, 58)
    context.draw(false, () => {
      this.setData({ canvasStatus: '绘制完成' })
    })
  },
  handleVideoPlay() {
    this.setData({ videoEvent: 'play' })
  },
  handleVideoPause() {
    this.setData({ videoEvent: 'pause' })
  },
  handleVideoEnded() {
    this.setData({ videoEvent: 'ended' })
  },
  handleVideoWaiting() {
    this.setData({ videoEvent: 'waiting' })
  },
  handleVideoTimeUpdate(event: WechatMiniprogram.CustomEvent<{
    currentTime: number
    duration: number
  }>) {
    this.setData({
      videoEvent: 'timeupdate',
      videoTime: `${event.detail.currentTime.toFixed(1)} / ${event.detail.duration.toFixed(1)}`,
    })
  },
  handleVideoProgress(event: WechatMiniprogram.CustomEvent<{ buffered: number }>) {
    this.setData({
      videoEvent: 'progress',
      videoBuffered: `${Math.round(event.detail.buffered)}%`,
    })
  },
  handleVideoError() {
    this.setData({ videoEvent: 'error' })
  },
})
