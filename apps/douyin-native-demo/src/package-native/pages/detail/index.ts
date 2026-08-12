Page({
  data: { ready: false },
  onLoad() {
    this.setData({ ready: true })
  },
  goBack() {
    tt.navigateBack()
  },
})
