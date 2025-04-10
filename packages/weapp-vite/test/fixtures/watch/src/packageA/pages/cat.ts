// import Cos from '@/utils/cos-wx-sdk-v5'
import globalStore from '@/stores/index'
import { formatTime } from '@/utils/util'
import { add as add0 } from 'lodash'
import { add as add1 } from 'lodash-es'

Page({
  data: {
    num0: add0(1, 1),
    num1: add1(2, 2),
    now: formatTime(new Date()),
    // Cos
  },
  onLoad(query) {
    globalStore.bind(this, '$data')
  },
  handleChangeTitle() {
    globalStore.data.title = '新标题'
    globalStore.update()
  },
})

console.log('cat')
