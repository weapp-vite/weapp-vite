<script setup lang="ts">
import { hasWxApi } from '../shared/runtime'
import { useDemoLog } from '../shared/useDemoLog'

definePageJson({
  navigationBarTitleText: '未分类',
})

const { statusText, statusTone, logText, setStatus, record }
  = useDemoLog()
setStatus('待操作', 'ready')

function runNextTick() {
  if (!hasWxApi('nextTick')) {
    setStatus('当前环境不支持 nextTick', 'warning')
    return
  }
  wx.nextTick(() => {
    record('wx.nextTick', { ok: true })
  })
}

function checkCanIUse() {
  if (!hasWxApi('canIUse')) {
    setStatus('当前环境不支持 canIUse', 'warning')
    return
  }
  const result = wx.canIUse('getSystemInfo')
  record('wx.canIUse', { getSystemInfo: result })
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">
        未分类能力
      </text>
      <text class="subtitle">
        缺少文档链接的 API 归档。
      </text>
      <view class="status" :class="[statusTone]">
        {{ statusText }}
      </view>
    </view>

    <view class="cards">
      <view class="card">
        <text class="card-title">
          nextTick
        </text>
        <text class="card-desc">
          wx.nextTick 在渲染后执行。
        </text>
        <view class="card-actions">
          <button class="btn" @tap="runNextTick">
            执行
          </button>
        </view>
      </view>

      <view class="card">
        <text class="card-title">
          canIUse
        </text>
        <text class="card-desc">
          wx.canIUse 检测 API 能力。
        </text>
        <view class="card-actions">
          <button class="btn secondary" @tap="checkCanIUse">
            检测
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
