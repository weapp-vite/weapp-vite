require
  .async('./bbb.js')
  .then((mod) => {
    console.log(mod)
  })
  .catch(({ errMsg, mod }) => {
    console.error(`path: ${mod}, ${errMsg}`)
  })

let common
require('./aaa.js', (mod) => {
  common = mod
}, ({ errMsg, mod }) => {
  console.error(`path: ${mod}, ${errMsg}`)
})

Page({
  sayHello() {
    common && common.sayHello()
  },
})
