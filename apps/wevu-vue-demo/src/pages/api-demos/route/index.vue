<script setup lang="ts">
import { hasWxApi } from '../shared/runtime'
import { useDemoLog } from '../shared/useDemoLog'

definePageJson({
  navigationBarTitleText: '路由能力',
})

const { statusText, statusTone, logText, setStatus, record, recordError }
  = useDemoLog()
setStatus('待操作', 'ready')

function getPageStack() {
  if (typeof getCurrentPages !== 'function') {
    setStatus('当前环境不支持 getCurrentPages', 'warning')
    return
  }
  const stack = getCurrentPages()
  record('getCurrentPages', stack.map(item => item.route))
}

function goToConfig() {
  if (!hasWxApi('navigateTo')) {
    setStatus('当前环境不支持 navigateTo', 'warning')
    return
  }
  wx.navigateTo({
    url: '/pages/config-js/index',
    success: () => record('wx.navigateTo', { url: '/pages/config-js/index' }),
    fail: err => recordError('wx.navigateTo fail', err),
  })
}

function goBack() {
  if (!hasWxApi('navigateBack')) {
    setStatus('当前环境不支持 navigateBack', 'warning')
    return
  }
  wx.navigateBack({
    delta: 1,
    fail: err => recordError('wx.navigateBack fail', err),
  })
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">
        路由能力
      </text>
      <text class="subtitle">
        页面栈与路由控制。
      </text>
      <view class="status" :class="[statusTone]">
        {{ statusText }}
      </view>
    </view>

    <view class="cards">
      <view class="card">
        <text class="card-title">
          查看页面栈
        </text>
        <text class="card-desc">
          getCurrentPages 获取路由栈。
        </text>
        <view class="card-actions">
          <button class="btn" @tap="getPageStack">
            查看
          </button>
        </view>
      </view>

      <view class="card">
        <text class="card-title">
          跳转页面
        </text>
        <text class="card-desc">
          wx.navigateTo 跳转到配置页。
        </text>
        <view class="card-actions">
          <button class="btn secondary" @tap="goToConfig">
            跳转
          </button>
          <button class="btn secondary" @tap="goBack">
            返回
          </button>
        </view>
        <text class="hint">
          返回按钮会离开当前页。
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
