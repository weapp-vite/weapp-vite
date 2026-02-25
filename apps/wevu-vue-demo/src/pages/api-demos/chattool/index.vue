<script setup lang="ts">
import { hasWxApi } from '../shared/runtime'
import { useDemoLog } from '../shared/useDemoLog'

definePageJson({
  navigationBarTitleText: '客服能力',
})

const { statusText, statusTone, logText, setStatus, record, recordError }
  = useDemoLog()
setStatus('待操作', 'ready')

function openChat() {
  if (!hasWxApi('openCustomerServiceChat')) {
    setStatus('当前环境不支持 openCustomerServiceChat', 'warning')
    return
  }
  setStatus('需要配置企业微信客服信息', 'warning')
  wx.openCustomerServiceChat({
    corpId: 'wxcorp_id',
    extInfo: {
      url: 'https://work.weixin.qq.com/',
    },
    success: res => record('wx.openCustomerServiceChat', res),
    fail: err => recordError('wx.openCustomerServiceChat fail', err),
  })
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">
        客服能力
      </text>
      <text class="subtitle">
        打开企业微信客服会话。
      </text>
      <view class="status" :class="[statusTone]">
        {{ statusText }}
      </view>
    </view>

    <view class="cards">
      <view class="card">
        <text class="card-title">
          客服会话
        </text>
        <text class="card-desc">
          wx.openCustomerServiceChat 打开客服。
        </text>
        <view class="card-actions">
          <button class="btn" @tap="openChat">
            打开
          </button>
        </view>
        <text class="hint">
          需配置 corpId 与客服链接。
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
