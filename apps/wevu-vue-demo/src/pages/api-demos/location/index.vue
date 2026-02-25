<script setup lang="ts">
import { hasWxApi } from '../shared/runtime'
import { useDemoLog } from '../shared/useDemoLog'

definePageJson({
  navigationBarTitleText: '位置能力',
})

const { statusText, statusTone, logText, setStatus, record, recordError }
  = useDemoLog()

setStatus('待操作', 'ready')

function getLocation() {
  if (!hasWxApi('getLocation')) {
    setStatus('当前环境不支持 getLocation', 'warning')
    return
  }
  wx.getLocation({
    type: 'gcj02',
    success: res => record('wx.getLocation', res),
    fail: err => recordError('wx.getLocation fail', err),
  })
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">
        位置能力
      </text>
      <text class="subtitle">
        需要用户授权定位权限。
      </text>
      <view class="status" :class="[statusTone]">
        {{ statusText }}
      </view>
    </view>

    <view class="cards">
      <view class="card">
        <text class="card-title">
          获取当前位置
        </text>
        <text class="card-desc">
          wx.getLocation 获取坐标。
        </text>
        <view class="card-actions">
          <button class="btn" @tap="getLocation">
            获取
          </button>
        </view>
        <text class="hint">
          需在真机授权定位。
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
