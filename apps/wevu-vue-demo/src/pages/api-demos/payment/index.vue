<script setup lang="ts">
import { hasWxApi } from '../shared/runtime'
import { useDemoLog } from '../shared/useDemoLog'

definePageJson({
  navigationBarTitleText: '支付能力',
})

const { statusText, statusTone, logText, setStatus, record, recordError }
  = useDemoLog()
setStatus('待操作', 'ready')

function requestPayment() {
  if (!hasWxApi('requestPayment')) {
    setStatus('当前环境不支持 requestPayment', 'warning')
    return
  }
  setStatus('需要完成商户与支付配置', 'warning')
  wx.requestPayment({
    timeStamp: '0',
    nonceStr: 'demo',
    package: 'prepay_id=demo',
    signType: 'MD5',
    paySign: 'demo',
    success: res => record('wx.requestPayment', res),
    fail: err => recordError('wx.requestPayment fail', err),
  })
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">
        支付能力
      </text>
      <text class="subtitle">
        需配置支付商户与后台签名。
      </text>
      <view class="status" :class="[statusTone]">
        {{ statusText }}
      </view>
    </view>

    <view class="cards">
      <view class="card">
        <text class="card-title">
          发起支付
        </text>
        <text class="card-desc">
          wx.requestPayment 需要后端签名。
        </text>
        <view class="card-actions">
          <button class="btn" @tap="requestPayment">
            发起
          </button>
        </view>
        <text class="hint">
          请替换为真实支付参数。
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
