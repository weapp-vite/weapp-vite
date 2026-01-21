<script setup lang="ts">
import { hasWxApi } from '../shared/runtime'
import { useDemoLog } from '../shared/useDemoLog'

definePageJson({
  navigationBarTitleText: 'Worker 能力',
})

const { statusText, statusTone, logText, setStatus, record, recordError }
  = useDemoLog()
const workerPath = 'workers/echo.js'

setStatus('待操作', 'ready')

function createWorker() {
  if (!hasWxApi('createWorker')) {
    setStatus('当前环境不支持 createWorker', 'warning')
    return
  }
  setStatus('需要配置 worker 脚本', 'warning')
  try {
    const worker = wx.createWorker(workerPath)
    worker.onMessage(res => record('worker.onMessage', res))
    worker.onError(err => recordError('worker.onError', err))
    worker.postMessage({ hello: 'wevu' })
    record('wx.createWorker', { workerPath })
  }
  catch (err) {
    recordError('wx.createWorker fail', err)
  }
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">
        Worker 能力
      </text>
      <text class="subtitle">
        多线程任务处理。
      </text>
      <view class="status {{ statusTone }}">
        {{ statusText }}
      </view>
    </view>

    <view class="cards">
      <view class="card">
        <text class="card-title">
          创建 Worker
        </text>
        <text class="card-desc">
          wx.createWorker 创建线程。
        </text>
        <view class="card-actions">
          <button class="btn" bindtap="createWorker">
            创建
          </button>
        </view>
        <text class="hint">
          需提供真实 worker 脚本。
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
