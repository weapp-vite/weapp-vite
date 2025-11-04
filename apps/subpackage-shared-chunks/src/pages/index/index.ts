import { isWx } from '@/config'
import { WordArray } from 'crypto-es'

Page({
  data: {
  },
  onClick() {
    console.log(WordArray, isWx)
    console.log('on click')
  },
})
