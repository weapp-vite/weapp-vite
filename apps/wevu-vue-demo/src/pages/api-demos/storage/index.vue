<script setup lang="ts">
import { hasWxApi } from '../shared/runtime'
import { useDemoLog } from '../shared/useDemoLog'

definePageJson({
  navigationBarTitleText: '存储能力',
})

const { statusText, statusTone, logText, setStatus, record, recordError }
  = useDemoLog()
const storageKey = 'wevu-demo-storage'

setStatus('待操作', 'ready')

function writeStorage() {
  if (!hasWxApi('setStorageSync')) {
    setStatus('当前环境不支持 setStorageSync', 'warning')
    return
  }
  try {
    const payload = {
      time: Date.now(),
      note: 'wevu storage demo',
    }
    wx.setStorageSync(storageKey, payload)
    record('wx.setStorageSync', payload)
  }
  catch (err) {
    recordError('wx.setStorageSync fail', err)
  }
}

function readStorage() {
  if (!hasWxApi('getStorageSync')) {
    setStatus('当前环境不支持 getStorageSync', 'warning')
    return
  }
  try {
    const result = wx.getStorageSync(storageKey)
    record('wx.getStorageSync', result)
  }
  catch (err) {
    recordError('wx.getStorageSync fail', err)
  }
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">
        存储能力
      </text>
      <text class="subtitle">
        本地缓存读写。
      </text>
      <view class="status" :class="[statusTone]">
        {{ statusText }}
      </view>
    </view>

    <view class="cards">
      <view class="card">
        <text class="card-title">
          写入缓存
        </text>
        <text class="card-desc">
          wx.setStorageSync 写入数据。
        </text>
        <view class="card-actions">
          <button class="btn" @tap="writeStorage">
            写入
          </button>
        </view>
      </view>

      <view class="card">
        <text class="card-title">
          读取缓存
        </text>
        <text class="card-desc">
          wx.getStorageSync 读取数据。
        </text>
        <view class="card-actions">
          <button class="btn secondary" @tap="readStorage">
            读取
          </button>
        </view>
      </view>
    </view>

    <view class="log">
      <text class="log-title">
        日志
      </text>
      <text class="log-body">
        {{ logText }}
      </text>
    </view>
  </view>
</template>

<style>
@import '../shared/page.css';
</style>
