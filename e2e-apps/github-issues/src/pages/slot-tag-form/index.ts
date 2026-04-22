Page({
  data: {
    sharedHeaderLabel: 'ready',
    sharedBodyLabel: 'alpha',
  },
  toggleLabels() {
    const nextHeader = this.data.sharedHeaderLabel === 'ready' ? 'updated' : 'ready'
    const nextBody = this.data.sharedBodyLabel === 'alpha' ? 'beta' : 'alpha'
    this.setData({
      sharedHeaderLabel: nextHeader,
      sharedBodyLabel: nextBody,
    })
  },
  _runE2E() {
    return {
      ok: typeof this.data.sharedHeaderLabel === 'string' && typeof this.data.sharedBodyLabel === 'string',
      sharedHeaderLabel: this.data.sharedHeaderLabel,
      sharedBodyLabel: this.data.sharedBodyLabel,
    }
  },
})
