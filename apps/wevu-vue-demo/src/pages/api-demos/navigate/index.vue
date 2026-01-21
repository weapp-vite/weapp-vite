<script setup lang="ts">
import { hasWxApi } from '../shared/runtime'
import { useDemoLog } from '../shared/useDemoLog'

definePageJson({
  navigationBarTitleText: '导航能力',
})

const { statusText, statusTone, logText, setStatus, record, recordError }
  = useDemoLog()
setStatus('待操作', 'ready')

function navigateToMiniProgram() {
  if (!hasWxApi('navigateToMiniProgram')) {
    setStatus('当前环境不支持 navigateToMiniProgram', 'warning')
    return
  }
  setStatus('需要配置目标小程序 appId', 'warning')
  wx.navigateToMiniProgram({
    appId: 'wx1234567890abcdef',
    path: '',
    success: res => record('wx.navigateToMiniProgram', res),
    fail: err => recordError('wx.navigateToMiniProgram fail', err),
  })
}

function exitMiniProgram() {
  if (!hasWxApi('exitMiniProgram')) {
    setStatus('当前环境不支持 exitMiniProgram', 'warning')
    return
  }
  wx.exitMiniProgram({
    fail: err => recordError('wx.exitMiniProgram fail', err),
  })
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">
        导航能力
      </text>
      <text class="subtitle">
        打开或退出小程序。
      </text>
      <view class="status {{ statusTone }}">
        {{ statusText }}
      </view>
    </view>

    <view class="cards">
      <view class="card">
        <text class="card-title">
          打开其他小程序
        </text>
        <text class="card-desc">
          wx.navigateToMiniProgram 跳转。
        </text>
        <view class="card-actions">
          <button class="btn" bindtap="navigateToMiniProgram">
            跳转
          </button>
        </view>
        <text class="hint">
          需配置真实 appId 与路径。
        </text>
      </view>

      <view class="card">
        <text class="card-title">
          退出小程序
        </text>
        <text class="card-desc">
          wx.exitMiniProgram 退出当前小程序。
        </text>
        <view class="card-actions">
          <button class="btn secondary" bindtap="exitMiniProgram">
            退出
          </button>
        </view>
        <text class="hint">
          此操作会直接退出。
        </text>
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
