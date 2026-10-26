function summarize(dataset: Record<string, unknown>) {
  const item = dataset.item as { value?: unknown, nested?: { count?: unknown } } | undefined
  return [
    typeof dataset.item,
    item?.value,
    item?.nested?.count,
    typeof dataset.index,
    dataset.index,
    typeof dataset.enabled,
    dataset.enabled,
    typeof dataset.literal,
    dataset.literal,
    typeof dataset.mixed,
    dataset.mixed,
  ].join('|')
}

Page({
  data: {
    rows: [{ id: 'same', value: 'pending', nested: { count: 1 } }],
    snapshot: '',
    selector: '',
    observer: '',
    summary: '',
  },
  capture(event: WechatMiniprogram.CustomEvent) {
    const kind = event.type === 'select' ? 'component' : 'event'
    this.setData({ snapshot: JSON.stringify(event.currentTarget.dataset), summary: `${kind}|${summarize(event.currentTarget.dataset)}` })
  },
  replace() {
    this.setData({ rows: [{ id: 'same', value: 'complete', nested: { count: 2 } }] })
  },
  query() {
    wx.createSelectorQuery().select('#row-0').fields({ dataset: true }, (result) => {
      this.setData({ selector: JSON.stringify(result.dataset), summary: `selector|${summarize(result.dataset)}` })
    }).exec()
  },
  observe() {
    const observer = this.createIntersectionObserver({})
    observer.relativeToViewport().observe('#row-0', (result) => {
      this.setData({ observer: JSON.stringify(result.dataset), summary: `observer|${summarize(result.dataset)}` })
      observer.disconnect()
    })
  },
})
