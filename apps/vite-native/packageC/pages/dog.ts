import globalStore from '@/stores/index'
import { getPackageName } from '../utils'

console.log('dog')
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
    getPackageName()
    console.log('哦哦哦', globalStore)
  },
})
