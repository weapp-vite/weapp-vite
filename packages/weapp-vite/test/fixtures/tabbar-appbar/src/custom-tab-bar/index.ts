const a = require('../pages/index/other')

Component({
  lifetimes:{
    async attached() {
        console.log(a)

        const mod = await require.async('../pages/index/async.js')

        console.log(mod)
    },
  }
})