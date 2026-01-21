<script setup lang="ts">
import { hasWxApi } from '../shared/runtime'
import { useDemoLog } from '../shared/useDemoLog'

definePageJson({
  navigationBarTitleText: 'WXML 能力',
})

const { statusText, statusTone, logText, setStatus, record, recordError }
  = useDemoLog()
setStatus('待操作', 'ready')

function queryNode() {
  if (!hasWxApi('createSelectorQuery')) {
    setStatus('当前环境不支持 createSelectorQuery', 'warning')
    return
  }
  wx.createSelectorQuery()
    .select('.probe')
    .boundingClientRect()
    .exec((res) => {
      record('SelectorQuery.boundingClientRect', res?.[0])
    })
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">
        WXML 能力
      </text>
      <text class="subtitle">
        节点查询与布局信息。
      </text>
      <view class="status {{ statusTone }}">
        {{ statusText }}
      </view>
    </view>

    <view class="cards">
      <view class="card">
        <text class="card-title">
          节点查询
        </text>
        <text class="card-desc">
          wx.createSelectorQuery 查询布局。
        </text>
        <view class="card-actions">
          <button class="btn" bindtap="queryNode">
            查询
          </button>
        </view>
        <text class="hint">
          测量下方高亮区域。
        </text>
      </view>
    </view>

    <view class="probe">
      测量目标区域
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

.probe {
  margin-top: 20rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  background: #1c2a5b;
  color: #ffffff;
  font-size: 24rpx;
  text-align: center;
}
</style>
