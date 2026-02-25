<script setup lang="ts">
import { getWxApi } from '../shared/runtime'
import { useDemoLog } from '../shared/useDemoLog'

definePageJson({
  navigationBarTitleText: '云开发',
})

const { statusText, statusTone, logText, setStatus, record, recordError }
  = useDemoLog()
setStatus('待操作', 'ready')

type CloudApi = typeof wx.cloud

function initCloud() {
  const cloud = getWxApi<CloudApi>('cloud')
  if (!cloud) {
    setStatus('当前环境未开启云开发', 'warning')
    return
  }
  try {
    cloud.init({ env: '', traceUser: true })
    record('wx.cloud.init', { ok: true })
  }
  catch (err) {
    recordError('wx.cloud.init fail', err)
  }
}

function callFunction() {
  const cloud = getWxApi<CloudApi>('cloud')
  if (!cloud) {
    setStatus('当前环境未开启云开发', 'warning')
    return
  }
  setStatus('需要配置云函数环境', 'warning')
  cloud.callFunction({
    name: 'demo',
    data: { from: 'wevu' },
    success: res => record('wx.cloud.callFunction', res),
    fail: err => recordError('wx.cloud.callFunction fail', err),
  })
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">
        云开发
      </text>
      <text class="subtitle">
        云函数与云数据库能力。
      </text>
      <view class="status" :class="[statusTone]">
        {{ statusText }}
      </view>
    </view>

    <view class="cards">
      <view class="card">
        <text class="card-title">
          初始化云开发
        </text>
        <text class="card-desc">
          wx.cloud.init 初始化环境。
        </text>
        <view class="card-actions">
          <button class="btn" @tap="initCloud">
            初始化
          </button>
        </view>
      </view>

      <view class="card">
        <text class="card-title">
          调用云函数
        </text>
        <text class="card-desc">
          wx.cloud.callFunction 调用云函数。
        </text>
        <view class="card-actions">
          <button class="btn secondary" @tap="callFunction">
            调用
          </button>
        </view>
        <text class="hint">
          需配置真实云函数名。
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
