Page({
  data: { value: 'not loaded', count: 0, revision: 'page:initial' },
  async loadLazy() {
    const module = await require.async('../../shared/lazy/runtime.ts')
    const value = module.lazyValue()
    this.setData({ value, count: this.data.count + 1 })
    return value
  },
})
