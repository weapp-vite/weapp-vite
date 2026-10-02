const marker = 'BATCH_BASE'
Page({
  data: { count: 0, input: '', marker },
  increment() {
    this.setData({ count: this.data.count + 1, marker })
  },
  onInput(event) {
    this.setData({ input: event.detail.value })
  },
})
