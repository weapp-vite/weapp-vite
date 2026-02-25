<script setup lang="ts">
import { hasWxApi } from '../shared/runtime'
import { useDemoLog } from '../shared/useDemoLog'

definePageJson({
  navigationBarTitleText: '界面能力',
})

const { statusText, statusTone, logText, setStatus, record, recordError }
  = useDemoLog()
setStatus('待操作', 'ready')

function showToast() {
  if (!hasWxApi('showToast')) {
    setStatus('当前环境不支持 showToast', 'warning')
    return
  }
  wx.showToast({
    title: 'WeVU Demo',
    icon: 'success',
    success: () => record('wx.showToast', { ok: true }),
    fail: err => recordError('wx.showToast fail', err),
  })
}

function showModal() {
  if (!hasWxApi('showModal')) {
    setStatus('当前环境不支持 showModal', 'warning')
    return
  }
  wx.showModal({
    title: '提示',
    content: '这是一个界面能力示例。',
    success: res => record('wx.showModal', res),
    fail: err => recordError('wx.showModal fail', err),
  })
}

function showLoading() {
  if (!hasWxApi('showLoading')) {
    setStatus('当前环境不支持 showLoading', 'warning')
    return
  }
  wx.showLoading({
    title: '加载中',
  })
  setTimeout(() => {
    if (hasWxApi('hideLoading')) {
      wx.hideLoading()
    }
    record('wx.showLoading', { ok: true })
  }, 800)
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">
        界面能力
      </text>
      <text class="subtitle">
        提示、对话框与加载态。
      </text>
      <view class="status" :class="[statusTone]">
        {{ statusText }}
      </view>
    </view>

    <view class="cards">
      <view class="card">
        <text class="card-title">
          Toast 提示
        </text>
        <text class="card-desc">
          wx.showToast 显示轻提示。
        </text>
        <view class="card-actions">
          <button class="btn" @tap="showToast">
            显示
          </button>
        </view>
      </view>

      <view class="card">
        <text class="card-title">
          Modal 对话框
        </text>
        <text class="card-desc">
          wx.showModal 交互确认。
        </text>
        <view class="card-actions">
          <button class="btn secondary" @tap="showModal">
            打开
          </button>
        </view>
      </view>

      <view class="card">
        <text class="card-title">
          Loading
        </text>
        <text class="card-desc">
          wx.showLoading 展示加载状态。
        </text>
        <view class="card-actions">
          <button class="btn secondary" @tap="showLoading">
            触发
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
