<script setup lang="ts">
import { hasWxApi } from '../shared/runtime'
import { useDemoLog } from '../shared/useDemoLog'

definePageJson({
  navigationBarTitleText: '数据分析',
})

const { statusText, statusTone, logText, setStatus, record, recordError }
  = useDemoLog()
setStatus('待操作', 'ready')

function reportAnalytics() {
  if (!hasWxApi('reportAnalytics')) {
    setStatus('当前环境不支持 reportAnalytics', 'warning')
    return
  }
  setStatus('需要配置自定义事件', 'warning')
  try {
    wx.reportAnalytics('wevu_demo', {
      action: 'tap',
      time: Date.now(),
    })
    record('wx.reportAnalytics', { event: 'wevu_demo' })
  }
  catch (err) {
    recordError('wx.reportAnalytics fail', err)
  }
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">
        数据分析
      </text>
      <text class="subtitle">
        埋点与事件上报。
      </text>
      <view class="status {{ statusTone }}">
        {{ statusText }}
      </view>
    </view>

    <view class="cards">
      <view class="card">
        <text class="card-title">
          上报事件
        </text>
        <text class="card-desc">
          wx.reportAnalytics 上报自定义事件。
        </text>
        <view class="card-actions">
          <button class="btn" bindtap="reportAnalytics">
            上报
          </button>
        </view>
        <text class="hint">
          需在平台配置事件名与字段。
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
