import { x } from './utils'

const cc = require('./utils/async')

require
  .async('./ra.ts')
  .then((mod) => {
    console.log(mod)
  })
  .catch(({ errMsg, mod }) => {
    console.error(`path: ${mod}, ${errMsg}`)
  })

let common
require('./rsc', (mod) => {
  common = mod
}, ({ errMsg, mod }) => {
  console.error(`path: ${mod}, ${errMsg}`)
})

App(
  {
    onLaunch() {
      console.log('onLaunch', x, cc)
    },
    async  onShow() {
      const { y } = await import('./utils/async')
      console.log('onShow', y)
    },
  },
)
