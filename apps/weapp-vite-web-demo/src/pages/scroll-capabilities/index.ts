Page({
  data: {
    alignment: 'start',
    target: '',
    offset: 0,
    lateVisible: false,
    flexEnabled: false,
    enhanced: false,
    showScrollbar: true,
    startCount: 0,
    scrollCount: 0,
    endCount: 0,
    scrollTop: 0,
    endTop: 0,
  },
  align(event: WechatMiniprogram.TouchEvent) {
    this.setData({ alignment: String(event.currentTarget.dataset.alignment), target: 'position-target', offset: 0 })
  },
  applyOffset() {
    this.setData({ alignment: 'start', target: 'position-target', offset: 20 })
  },
  chooseLate() {
    this.setData({ target: 'late-target', alignment: 'start', offset: 0 })
  },
  insertLate() {
    this.setData({ lateVisible: true })
  },
  toggleFlex() {
    this.setData({ flexEnabled: !this.data.flexEnabled })
  },
  hideScrollbar() {
    this.setData({ enhanced: true, showScrollbar: false })
  },
  restoreScrollbar() {
    this.setData({ enhanced: false })
  },
  handleStart() {
    this.setData({ startCount: this.data.startCount + 1 })
  },
  handleScroll(event: WechatMiniprogram.CustomEvent<{ scrollTop: number }>) {
    this.setData({ scrollCount: this.data.scrollCount + 1, scrollTop: event.detail.scrollTop })
  },
  handleEnd(event: WechatMiniprogram.CustomEvent<{ scrollTop: number }>) {
    this.setData({ endCount: this.data.endCount + 1, endTop: event.detail.scrollTop })
  },
})
