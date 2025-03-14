import { SM3 } from 'gm-crypto'

Component({
  lifetimes: {
    ready() {
      console.log(SM3.digest('abc'))
      console.log(SM3.digest('YWJj', 'base64'))
      console.log(SM3.digest('616263', 'hex', 'base64'))
    },
  },
})
