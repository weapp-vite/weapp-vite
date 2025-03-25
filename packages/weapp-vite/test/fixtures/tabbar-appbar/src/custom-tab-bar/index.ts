const a = require('../pages/index/other')

Component({
  lifetimes:{
    attached() {
        console.log(a)
    },
  }
})