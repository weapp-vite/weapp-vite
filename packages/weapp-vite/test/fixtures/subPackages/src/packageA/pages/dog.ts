console.log('dog')
import { getPackageName } from '../packageA-utils'
// require('../subPackageB/utils.js', (utils) => {
//   console.log(utils.whoami) // Wechat MiniProgram
// }, ({ mod, errMsg }) => {
//   console.error(`path: ${mod}, ${errMsg}`)
// })
// 或者使用 Promise 风格的调用
// require.async('../utils.ts').then((pkg) => {
//   console.log(pkg.getPackageName())
// }).catch(({ mod, errMsg }) => {
//   console.error(`path: ${mod}, ${errMsg}`)
// })

Page({
  showDialog() {
    console.log('哦哦哦')
  },
  onLoad(query) {
    getPackageName()
  },
})
