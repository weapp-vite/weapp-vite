<script setup lang="ts">
import { hasWxApi } from '../shared/runtime'
import { useDemoLog } from '../shared/useDemoLog'

definePageJson({
  navigationBarTitleText: '设备能力',
})

const { statusText, statusTone, logText, setStatus, record, recordError }
  = useDemoLog()
setStatus('待操作', 'ready')

function runNetworkType() {
  if (!hasWxApi('getNetworkType')) {
    setStatus('当前环境不支持 getNetworkType', 'warning')
    return
  }
  wx.getNetworkType({
    success: res => record('wx.getNetworkType', res),
    fail: err => recordError('wx.getNetworkType fail', err),
  })
}

function runVibrate() {
  if (!hasWxApi('vibrateShort')) {
    setStatus('当前环境不支持 vibrateShort', 'warning')
    return
  }
  wx.vibrateShort({
    type: 'medium',
    success: () => record('wx.vibrateShort', { ok: true }),
    fail: err => recordError('wx.vibrateShort fail', err),
  })
}

function runBatteryInfo() {
  if (!hasWxApi('getBatteryInfo')) {
    setStatus('当前环境不支持 getBatteryInfo', 'warning')
    return
  }
  wx.getBatteryInfo({
    success: res => record('wx.getBatteryInfo', res),
    fail: err => recordError('wx.getBatteryInfo fail', err),
  })
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">
        设备能力
      </text>
      <text class="subtitle">
        网络、电量、振动等硬件能力。
      </text>
      <view class="status" :class="[statusTone]">
        {{ statusText }}
      </view>
    </view>

    <view class="cards">
      <view class="card">
        <text class="card-title">
          网络状态
        </text>
        <text class="card-desc">
          wx.getNetworkType 获取当前网络类型。
        </text>
        <view class="card-actions">
          <button class="btn" @tap="runNetworkType">
            获取
          </button>
        </view>
      </view>

      <view class="card">
        <text class="card-title">
          振动反馈
        </text>
        <text class="card-desc">
          wx.vibrateShort 触发短振动。
        </text>
        <view class="card-actions">
          <button class="btn" @tap="runVibrate">
            触发
          </button>
        </view>
      </view>

      <view class="card">
        <text class="card-title">
          电量信息
        </text>
        <text class="card-desc">
          wx.getBatteryInfo 读取电量状态。
        </text>
        <view class="card-actions">
          <button class="btn" @tap="runBatteryInfo">
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
