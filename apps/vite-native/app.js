import dayjs from 'dayjs'
import { add } from 'lodash'

const { formatTime } = require('./utils/util')

console.log(add(1, 2))
console.log(dayjs())

const worker = wx.createWorker('workers/index.js')
// app.js
App({
  data: {
    time: formatTime(new Date()),
  },
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 登录
    wx.login({
      success: (res) => {
        console.log(res)
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
      },
    })
    worker.postMessage({
      msg: 'hello from worker',
    })
  },
  globalData: {
    userInfo: null,
  },
})
