Component({
  lifetimes:{
    async attached() {
      const mod = await require.async('../../pages/index/async.js')
      console.log(mod)
    },
  }
})
