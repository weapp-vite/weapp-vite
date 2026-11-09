import init from '../../../assets/add.wasm?init'

Page({
  data: { value: 'none' },
  async run() {
    const instance = await init({})
    const value = instance.exports.add(19, 23)
    this.setData({ value: String(value) })
    return { value }
  },
})
