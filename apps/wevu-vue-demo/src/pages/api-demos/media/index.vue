<script setup lang="ts">
import { ref } from 'wevu'
import { hasWxApi } from '../shared/runtime'
import { useDemoLog } from '../shared/useDemoLog'

definePageJson({
  navigationBarTitleText: '媒体能力',
})

const { statusText, statusTone, logText, setStatus, record, recordError }
  = useDemoLog()
const images = ref<string[]>([])

setStatus('待操作', 'ready')

function chooseImage() {
  if (!hasWxApi('chooseImage')) {
    setStatus('当前环境不支持 chooseImage', 'warning')
    return
  }
  wx.chooseImage({
    count: 3,
    success: (res) => {
      images.value = res.tempFilePaths || []
      record('wx.chooseImage', res)
    },
    fail: err => recordError('wx.chooseImage fail', err),
  })
}

function previewImage() {
  if (!hasWxApi('previewImage')) {
    setStatus('当前环境不支持 previewImage', 'warning')
    return
  }
  if (!images.value.length) {
    setStatus('请先选择图片', 'warning')
    return
  }
  record('wx.previewImage', {
    current: images.value[0],
    total: images.value.length,
  })
  wx.previewImage({
    urls: images.value,
    current: images.value[0],
    fail: err => recordError('wx.previewImage fail', err),
  })
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">
        媒体能力
      </text>
      <text class="subtitle">
        图片选择与预览体验。
      </text>
      <view class="status" :class="[statusTone]">
        {{ statusText }}
      </view>
    </view>

    <view class="cards">
      <view class="card">
        <text class="card-title">
          选择图片
        </text>
        <text class="card-desc">
          wx.chooseImage 从相册/拍照选图。
        </text>
        <view class="card-actions">
          <button class="btn" @tap="chooseImage">
            选择
          </button>
        </view>
      </view>

      <view class="card">
        <text class="card-title">
          预览图片
        </text>
        <text class="card-desc">
          wx.previewImage 预览已选图片。
        </text>
        <view class="card-actions">
          <button class="btn secondary" @tap="previewImage">
            预览
          </button>
        </view>
        <text class="hint">
          需先选择图片。
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
