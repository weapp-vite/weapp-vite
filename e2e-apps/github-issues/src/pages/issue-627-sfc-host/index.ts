Page({
  data: {
    title: 'issue-627 sfc host reserved props',
  },
  _runE2E() {
    const literal = this.selectComponent?.('#issue627-sfc-host-literal') as any
    const dynamic = this.selectComponent?.('#issue627-sfc-host-dynamic') as any
    return {
      literal: typeof literal?._runE2E === 'function' ? literal._runE2E() : null,
      dynamic: typeof dynamic?._runE2E === 'function' ? dynamic._runE2E() : null,
    }
  },
})
