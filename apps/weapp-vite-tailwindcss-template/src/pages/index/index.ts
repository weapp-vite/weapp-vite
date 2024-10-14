import { hello } from '@/utils/util'

Page({
  data: {
    mode: 'light',
  },
  switchMode() {
    if (this.data.mode === 'light') {
      this.setData({
        mode: 'dark',
      })
    }
    else {
      this.setData({
        mode: 'light',
      })
    }
  },
  onLoad() {
    console.log(hello())
  },
})
