Page({
  data: { label: 'dynamic', count: 0, track: '' },
  tap(event) {
    this.setData({ count: this.data.count + 1, track: event.currentTarget.dataset.analytics })
  },
})
