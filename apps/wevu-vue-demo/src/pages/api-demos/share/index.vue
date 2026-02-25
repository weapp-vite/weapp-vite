<script setup lang="ts">
import { hasWxApi } from '../shared/runtime'
import { useDemoLog } from '../shared/useDemoLog'

definePageJson({
  navigationBarTitleText: '分享能力',
})

const { statusText, statusTone, logText, setStatus, record, recordError }
  = useDemoLog()
setStatus('待操作', 'ready')

function showShareMenu() {
  if (!hasWxApi('showShareMenu')) {
    setStatus('当前环境不支持 showShareMenu', 'warning')
    return
  }
  wx.showShareMenu({
    withShareTicket: true,
    success: res => record('wx.showShareMenu', res),
    fail: err => recordError('wx.showShareMenu fail', err),
  })
}

function updateShareMenu() {
  if (!hasWxApi('updateShareMenu')) {
    setStatus('当前环境不支持 updateShareMenu', 'warning')
    return
  }
  wx.updateShareMenu({
    withShareTicket: true,
    success: res => record('wx.updateShareMenu', res),
    fail: err => recordError('wx.updateShareMenu fail', err),
  })
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">
        分享能力
      </text>
      <text class="subtitle">
        控制分享菜单与配置。
      </text>
      <view class="status" :class="[statusTone]">
        {{ statusText }}
      </view>
    </view>

    <view class="cards">
      <view class="card">
        <text class="card-title">
          展示分享菜单
        </text>
        <text class="card-desc">
          wx.showShareMenu 打开分享入口。
        </text>
        <view class="card-actions">
          <button class="btn" @tap="showShareMenu">
            展示
          </button>
        </view>
      </view>

      <view class="card">
        <text class="card-title">
          更新分享配置
        </text>
        <text class="card-desc">
          wx.updateShareMenu 更新分享参数。
        </text>
        <view class="card-actions">
          <button class="btn secondary" @tap="updateShareMenu">
            更新
          </button>
        </view>
        <text class="hint">
          需要在页面中实现分享回调。
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
