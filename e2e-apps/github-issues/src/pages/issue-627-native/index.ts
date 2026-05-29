Page({
  data: {
    title: 'issue-627 native reserved props',
  },
  _runE2E() {
    const probe = this.selectComponent?.('#issue627-native-probe') as any
    const sfcLiteral = this.selectComponent?.('#issue627-sfc-host-literal') as any
    const sfcDynamic = this.selectComponent?.('#issue627-sfc-host-dynamic') as any
    return {
      native: typeof probe?.snapshot === 'function' ? probe.snapshot() : null,
      sfcLiteral: typeof sfcLiteral?._runE2E === 'function' ? sfcLiteral._runE2E() : null,
      sfcDynamic: typeof sfcDynamic?._runE2E === 'function' ? sfcDynamic._runE2E() : null,
    }
  },
})
