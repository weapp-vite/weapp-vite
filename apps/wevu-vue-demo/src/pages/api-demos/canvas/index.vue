<script setup lang="ts">
import { hasWxApi } from '../shared/runtime'
import { useDemoLog } from '../shared/useDemoLog'

definePageJson({
  navigationBarTitleText: '画布能力',
})

const { statusText, statusTone, logText, setStatus, record, recordError }
  = useDemoLog()

setStatus('待操作', 'ready')

function drawCanvas() {
  if (!hasWxApi('createCanvasContext')) {
    setStatus('当前环境不支持 createCanvasContext', 'warning')
    return
  }
  try {
    const ctx = wx.createCanvasContext('demoCanvas')
    ctx.setFillStyle('#273277')
    ctx.fillRect(20, 20, 140, 80)
    ctx.setStrokeStyle('#f59e0b')
    ctx.setLineWidth(4)
    ctx.strokeRect(20, 120, 200, 90)
    ctx.setFillStyle('#1b1c2b')
    ctx.setFontSize(20)
    ctx.fillText('WeVU Canvas', 24, 170)
    ctx.draw()
    record('wx.createCanvasContext', { ok: true })
  }
  catch (err) {
    recordError('draw canvas fail', err)
  }
}

function clearCanvas() {
  if (!hasWxApi('createCanvasContext')) {
    setStatus('当前环境不支持 createCanvasContext', 'warning')
    return
  }
  const ctx = wx.createCanvasContext('demoCanvas')
  ctx.clearRect(0, 0, 300, 220)
  ctx.draw()
  record('clear canvas', { ok: true })
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">
        画布能力
      </text>
      <text class="subtitle">
        Canvas 绘制示例。
      </text>
      <view class="status" :class="[statusTone]">
        {{ statusText }}
      </view>
    </view>

    <view class="cards">
      <view class="card">
        <text class="card-title">
          绘制画布
        </text>
        <text class="card-desc">
          wx.createCanvasContext 基础绘制。
        </text>
        <view class="card-actions">
          <button class="btn" @tap="drawCanvas">
            绘制
          </button>
          <button class="btn secondary" @tap="clearCanvas">
            清空
          </button>
        </view>
      </view>
    </view>

    <canvas canvas-id="demoCanvas" class="canvas" />

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

.canvas {
  width: 100%;
  height: 220px;
  margin-top: 20rpx;
  border-radius: 16rpx;
  background: #ffffff;
}
</style>
