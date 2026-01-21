<script setup lang="ts">
import { hasWxApi } from '../shared/runtime'
import { useDemoLog } from '../shared/useDemoLog'

definePageJson({
  navigationBarTitleText: 'AI 能力',
})

const { statusText, statusTone, logText, setStatus, record, recordError }
  = useDemoLog()

setStatus('待操作', 'ready')

function createVKSession() {
  if (!hasWxApi('createVKSession')) {
    setStatus('当前环境不支持 createVKSession', 'warning')
    return
  }
  setStatus('需要 WebGL 上下文与 VisionKit 配置', 'warning')
  try {
    const session = (wx as any).createVKSession({})
    record('wx.createVKSession', { session: !!session })
  }
  catch (err) {
    recordError('wx.createVKSession fail', err)
  }
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">
        AI 能力
      </text>
      <text class="subtitle">
        VisionKit 等 AI 能力示例。
      </text>
      <view class="status {{ statusTone }}">
        {{ statusText }}
      </view>
    </view>

    <view class="cards">
      <view class="card">
        <text class="card-title">
          创建 VKSession
        </text>
        <text class="card-desc">
          wx.createVKSession 需要 WebGL 环境。
        </text>
        <view class="card-actions">
          <button class="btn" bindtap="createVKSession">
            创建
          </button>
        </view>
        <text class="hint">
          需按官方指引初始化 VisionKit。
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
