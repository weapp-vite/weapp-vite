<script setup lang="ts">
import { hasWxApi } from '../shared/runtime'
import { useDemoLog } from '../shared/useDemoLog'

definePageJson({
  navigationBarTitleText: '基础能力',
})

const { statusText, statusTone, logText, setStatus, record, recordError }
  = useDemoLog()
setStatus('待操作', 'ready')

function runSystemInfo() {
  if (!hasWxApi('getSystemInfo')) {
    setStatus('当前环境不支持 getSystemInfo', 'warning')
    return
  }
  wx.getSystemInfo({
    success: res => record('wx.getSystemInfo', res),
    fail: err => recordError('wx.getSystemInfo fail', err),
  })
}

function runAppBaseInfo() {
  if (!hasWxApi('getAppBaseInfo')) {
    setStatus('当前环境不支持 getAppBaseInfo', 'warning')
    return
  }
  try {
    const info = wx.getAppBaseInfo()
    record('wx.getAppBaseInfo', info)
  }
  catch (err) {
    recordError('wx.getAppBaseInfo fail', err)
  }
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">
        基础能力
      </text>
      <text class="subtitle">
        系统、运行环境与基础信息查询。
      </text>
      <view class="status {{ statusTone }}">
        {{ statusText }}
      </view>
    </view>

    <view class="cards">
      <view class="card">
        <text class="card-title">
          系统信息
        </text>
        <text class="card-desc">
          wx.getSystemInfo 获取设备与系统信息。
        </text>
        <view class="card-actions">
          <button class="btn" bindtap="runSystemInfo">
            获取
          </button>
        </view>
      </view>

      <view class="card">
        <text class="card-title">
          应用基础信息
        </text>
        <text class="card-desc">
          wx.getAppBaseInfo 获取微信 App 维度信息。
        </text>
        <view class="card-actions">
          <button class="btn" bindtap="runAppBaseInfo">
            获取
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
