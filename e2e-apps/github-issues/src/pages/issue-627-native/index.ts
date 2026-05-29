Page({
  data: {
    title: 'issue-627 native reserved props',
  },
  _runE2E() {
    const probe = this.selectComponent?.('#issue627-native-probe') as any
    return {
      literal: typeof probe?.snapshot === 'function' ? probe.snapshot() : null,
    }
  },
})
