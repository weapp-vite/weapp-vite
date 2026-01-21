<script setup lang="ts">
import { hasWxApi } from '../shared/runtime'
import { useDemoLog } from '../shared/useDemoLog'

definePageJson({
  navigationBarTitleText: 'Ext 能力',
})

const { statusText, statusTone, logText, setStatus, record, recordError }
  = useDemoLog()
setStatus('待操作', 'ready')

function getExtConfigSync() {
  if (!hasWxApi('getExtConfigSync')) {
    setStatus('当前环境不支持 getExtConfigSync', 'warning')
    return
  }
  try {
    const config = wx.getExtConfigSync()
    record('wx.getExtConfigSync', config)
  }
  catch (err) {
    recordError('wx.getExtConfigSync fail', err)
  }
}

function getExtConfig() {
  if (!hasWxApi('getExtConfig')) {
    setStatus('当前环境不支持 getExtConfig', 'warning')
    return
  }
  wx.getExtConfig({
    success: res => record('wx.getExtConfig', res),
    fail: err => recordError('wx.getExtConfig fail', err),
  })
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">
        Ext 能力
      </text>
      <text class="subtitle">
        第三方平台扩展配置。
      </text>
      <view class="status {{ statusTone }}">
        {{ statusText }}
      </view>
    </view>

    <view class="cards">
      <view class="card">
        <text class="card-title">
          同步获取配置
        </text>
        <text class="card-desc">
          wx.getExtConfigSync 获取扩展配置。
        </text>
        <view class="card-actions">
          <button class="btn" bindtap="getExtConfigSync">
            获取
          </button>
        </view>
      </view>

      <view class="card">
        <text class="card-title">
          异步获取配置
        </text>
        <text class="card-desc">
          wx.getExtConfig 异步读取。
        </text>
        <view class="card-actions">
          <button class="btn secondary" bindtap="getExtConfig">
            获取
          </button>
        </view>
        <text class="hint">
          需在 ext.json 中配置。
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
