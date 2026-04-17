Page({
  data: {
    a: 1,
    b: 2,
  },

  readProbeState() {
    const probe = this.selectComponent('#issue466-computed-probe') as any
    return probe?._runE2E?.() ?? null
  },

  _runE2E() {
    return {
      pageData: {
        a: this.data.a,
        b: this.data.b,
      },
      probe: this.readProbeState(),
    }
  },

  applyNextE2E() {
    this.setData({
      a: 3,
      b: 4,
    })
    return this._runE2E()
  },
})
