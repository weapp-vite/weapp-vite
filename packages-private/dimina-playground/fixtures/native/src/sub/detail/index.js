Page({
  data: { value: 1, selected: '', mode: 0 },
  increment() { this.setData({ value: this.data.value + 1 }) },
  selected(event) { this.setData({ selected: `${event.detail.label}:${event.detail.value}` }) },
  roots() { this.setData({ mode: (this.data.mode + 1) % 3 }) },
  back() { wx.navigateBack() },
})
