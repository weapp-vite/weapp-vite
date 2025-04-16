let common;
require('../../subpackage/common.js', (mod) => {
    common = mod
}, ({ errMsg, mod }) => {
    console.error(`path: ${mod}, ${errMsg}`)
})

Page({
    sayHello() {
        common && common.sayHello()
    }
})