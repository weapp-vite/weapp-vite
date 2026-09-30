Page({
  data: { value: 1, show: true, selected: '', detached: 0 },
  increment() { this.setData({ value: this.data.value + 1 }) },
  remove() { this.setData({ show: false }) },
  restore() { this.setData({ show: true }) },
  capture() { this.setData({ detached: getApp().globalData.genericDetached }) },
  first(event) { this.setData({ selected: `first:${event.detail.label}:${event.detail.value}` }) },
  second(event) { this.setData({ selected: `second:${event.detail.label}:${event.detail.value}` }) },
  forwarded(event) { this.setData({ selected: `forwarded:${event.detail.label}:${event.detail.value}` }) },
})
