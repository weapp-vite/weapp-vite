Page({
  data: {
    callbackCount: 0,
    mappedCount: 0,
    disabledCount: 0,
  },
  onCallbackTap() {
    this.setData({ callbackCount: this.data.callbackCount + 1 })
  },
  onMappedTap() {
    this.setData({ mappedCount: this.data.mappedCount + 1 })
  },
  onDisabledTap() {
    this.setData({ disabledCount: this.data.disabledCount + 1 })
  },
  _runE2E() {
    return { ...this.data }
  },
})
