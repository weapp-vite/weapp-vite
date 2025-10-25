// import { add as add0 } from 'lodash'
import { add as add1 } from 'lodash-es'
// module 'util-CcGyoy9x.js' is not defined,
import { formatTime } from '@/utils/util'

console.log('apple')
Page({
  data: {
    // num0: add0(1, 1),
    num1: add1(2, 2),
    now: formatTime(new Date()),
  },
})
