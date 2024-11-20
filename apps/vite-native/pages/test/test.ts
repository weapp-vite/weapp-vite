import { clsx } from 'clsx'
import x, { a } from './aaa'
// const ccc = require('aaa')
Page({
  data: {
    className: clsx({
      'bg-[#45ea2c]': true,
    }, 'h-[323.43px]', 'flex items-start justify-center'),
  },
})

console.log(x, a)
