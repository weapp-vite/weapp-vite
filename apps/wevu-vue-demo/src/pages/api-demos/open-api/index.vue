<script setup lang="ts">
import { hasWxApi } from '../shared/runtime'
import { useDemoLog } from '../shared/useDemoLog'

definePageJson({
  navigationBarTitleText: '开放接口',
})

const { statusText, statusTone, logText, setStatus, record, recordError }
  = useDemoLog()
setStatus('待操作', 'ready')

function runLogin() {
  if (!hasWxApi('login')) {
    setStatus('当前环境不支持 login', 'warning')
    return
  }
  wx.login({
    success: res => record('wx.login', res),
    fail: err => recordError('wx.login fail', err),
  })
}

function getAccountInfo() {
  if (!hasWxApi('getAccountInfoSync')) {
    setStatus('当前环境不支持 getAccountInfoSync', 'warning')
    return
  }
  try {
    const info = wx.getAccountInfoSync()
    record('wx.getAccountInfoSync', info)
  }
  catch (err) {
    recordError('wx.getAccountInfoSync fail', err)
  }
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">
        开放接口
      </text>
      <text class="subtitle">
        登录与账号信息。
      </text>
      <view class="status {{ statusTone }}">
        {{ statusText }}
      </view>
    </view>

    <view class="cards">
      <view class="card">
        <text class="card-title">
          登录
        </text>
        <text class="card-desc">
          wx.login 获取登录凭证。
        </text>
        <view class="card-actions">
          <button class="btn" bindtap="runLogin">
            登录
          </button>
        </view>
      </view>

      <view class="card">
        <text class="card-title">
          账号信息
        </text>
        <text class="card-desc">
          wx.getAccountInfoSync 获取账号信息。
        </text>
        <view class="card-actions">
          <button class="btn secondary" bindtap="getAccountInfo">
            获取
          </button>
        </view>
        <text class="hint">
          部分信息仅在正式版可用。
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
