import { twMerge } from '@weapp-tailwindcss/merge'
import dayjs from 'dayjs'
import { add } from 'lodash'
import store from './stores'
import { formatTime } from './utils/util.js'

console.log(twMerge('weapp-reset-button px-6 py-2 font-medium tracking-wide text-white capitalize transition-colors duration-300 transform bg-blue-600 rounded-lg hover:bg-blue-500 focus:outline-none focus:ring focus:ring-blue-300 focus:ring-opacity-80', 'bg-[blue]'))
// const { formatTime } = require('./utils/util.js')

console.log(add(1, 2))
console.log(dayjs())
console.log('-'.repeat(100))

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
        console.log(res, store.data)
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
