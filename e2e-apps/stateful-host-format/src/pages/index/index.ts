import { state } from '../../shared'

Page({
  data: { result: 'not loaded', error: '' },
  async loadDynamicImport() {
    const before = state.evaluations
    const pending = import('../../lazy')
    const immediate = state.evaluations
    const lazy = await pending
    const value = lazy.default()
    this.setData({ result: `${value}:${state.evaluations}` })
    return { before, immediate, value, evaluations: state.evaluations }
  },
  setSharedValue(value: number) {
    state.value = value
  },
  async loadBrokenDynamicImport() {
    let synchronous = true
    try {
      const pending = import('../../broken')
      synchronous = false
      await pending
      return { synchronous, message: 'unexpected success' }
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.setData({ error: message })
      return { synchronous, message }
    }
  },
})
