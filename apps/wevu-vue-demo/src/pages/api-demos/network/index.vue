<script setup lang="ts">
import { hasWxApi } from '../shared/runtime'
import { useDemoLog } from '../shared/useDemoLog'

definePageJson({
  navigationBarTitleText: '网络能力',
})

const { statusText, statusTone, logText, setStatus, record, recordError }
  = useDemoLog()
const testUrl = 'https://httpbin.org/get'

setStatus('待操作', 'ready')

function runRequest() {
  if (!hasWxApi('request')) {
    setStatus('当前环境不支持 request', 'warning')
    return
  }
  wx.request({
    url: testUrl,
    method: 'GET',
    success: res => record('wx.request', res),
    fail: err => recordError('wx.request fail', err),
  })
}

function runDownload() {
  if (!hasWxApi('downloadFile')) {
    setStatus('当前环境不支持 downloadFile', 'warning')
    return
  }
  wx.downloadFile({
    url: testUrl,
    success: res => record('wx.downloadFile', res),
    fail: err => recordError('wx.downloadFile fail', err),
  })
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">
        网络能力
      </text>
      <text class="subtitle">
        需要在小程序后台配置合法域名。
      </text>
      <view class="status" :class="[statusTone]">
        {{ statusText }}
      </view>
    </view>

    <view class="cards">
      <view class="card">
        <text class="card-title">
          请求接口
        </text>
        <text class="card-desc">
          wx.request 发起 HTTPS 请求。
        </text>
        <view class="card-actions">
          <button class="btn" @tap="runRequest">
            请求
          </button>
        </view>
        <text class="hint">
          需将 https://httpbin.org 添加到合法域名。
        </text>
      </view>

      <view class="card">
        <text class="card-title">
          下载文件
        </text>
        <text class="card-desc">
          wx.downloadFile 下载资源。
        </text>
        <view class="card-actions">
          <button class="btn secondary" @tap="runDownload">
            下载
          </button>
        </view>
        <text class="hint">
          需配置下载域名。
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
