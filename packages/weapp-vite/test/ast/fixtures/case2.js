let common;
require('../../subpackage/common.js')

Page({
    sayHello() {
        common && common.sayHello()
    }
})