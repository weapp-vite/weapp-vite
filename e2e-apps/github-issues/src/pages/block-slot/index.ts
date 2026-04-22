Page({
  data: {
    headerLabel: 'ready',
    bodyLabel: 'alpha',
  },
  toggleLabels() {
    const nextHeader = this.data.headerLabel === 'ready' ? 'updated' : 'ready'
    const nextBody = this.data.bodyLabel === 'alpha' ? 'beta' : 'alpha'
    this.setData({
      headerLabel: nextHeader,
      bodyLabel: nextBody,
    })
  },
  _runE2E() {
    return {
      ok: typeof this.data.headerLabel === 'string' && typeof this.data.bodyLabel === 'string',
      headerLabel: this.data.headerLabel,
      bodyLabel: this.data.bodyLabel,
    }
  },
})
