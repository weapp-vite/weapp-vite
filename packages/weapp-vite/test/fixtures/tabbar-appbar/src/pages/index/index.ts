const { part } = require('./part')

const { other } = require('./other')

Page({
  async onLoad() {
    const mod = await require.async('./async')
    
    const mod2 = await import('./async2.ts')

    console.log(part, other, mod, mod2)
  },
})
