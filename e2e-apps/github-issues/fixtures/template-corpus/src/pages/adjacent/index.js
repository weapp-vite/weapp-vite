Page({
  data: { result: 'pending' },
  capture(event) {
    const { first, second, empty } = event.currentTarget.dataset
    this.setData({ result: [first, second, typeof empty, empty].join('|') })
  },
})
