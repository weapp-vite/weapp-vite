import { add as add0 } from 'lodash'
import { add as add1 } from 'lodash-es'

Page({
  data: {
    num0: add0(1, 1),
    num1: add1(2, 2),
  },
})

console.log('cat')
