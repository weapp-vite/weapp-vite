Page({
  data: {
    rows: [{ id: 'same', value: 'pending', nested: { count: 1 } }],
    snapshot: '',
    selector: '',
    observer: '',
  },
  capture(event: WechatMiniprogram.CustomEvent) {
    this.setData({ snapshot: JSON.stringify(event.currentTarget.dataset) })
  },
  replace() {
    this.setData({ rows: [{ id: 'same', value: 'complete', nested: { count: 2 } }] })
  },
  query() {
    this.createSelectorQuery().select('#row-0').fields({ dataset: true }, (result) => {
      this.setData({ selector: JSON.stringify(result.dataset) })
    }).exec()
  },
  observe() {
    const observer = this.createIntersectionObserver()
    observer.relativeToViewport().observe('#row-0', (result) => {
      this.setData({ observer: JSON.stringify(result.dataset) })
      observer.disconnect()
    })
  },
})
