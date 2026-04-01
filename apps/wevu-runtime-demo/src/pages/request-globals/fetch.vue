<script setup lang="ts">
import { onLoad, onUnload, ref } from 'wevu'
import {
  createErrorState,
  createInitialState,
  createSuccessState,
  installMockRequest,
  restoreMockRequest,
} from './shared'

const state = ref(createInitialState())

function pushRequestLog(entry: string) {
  state.value = {
    ...state.value,
    requestLog: [...state.value.requestLog, entry],
  }
}

async function runChecks() {
  state.value = {
    ...state.value,
    pageStatus: '校验中',
    payload: '',
    requestLog: [],
    runCount: state.value.runCount + 1,
    status: 'running',
  }

  try {
    const response = await fetch('https://request-globals.test/fetch', {
      method: 'POST',
      body: JSON.stringify({ run: state.value.runCount }),
    })
    const payload = await response.json()
    state.value = {
      ...state.value,
      ...createSuccessState(JSON.stringify(payload)),
    }
  }
  catch (error) {
    state.value = {
      ...state.value,
      ...createErrorState(error),
    }
  }
}

onLoad(() => {
  installMockRequest(pushRequestLog)
  void runChecks()
})

onUnload(() => {
  restoreMockRequest()
})
</script>

<template>
  <view class="page">
    <view class="hero">
      <text class="hero-title">fetch 验证</text>
      <text class="hero-desc">验证 request globals 注入后的原生 fetch 能力。</text>
    </view>

    <view class="panel">
      <view class="row">
        <text class="label">pageStatus</text>
        <text class="value">{{ state.pageStatus }}</text>
      </view>
      <view class="row">
        <text class="label">status</text>
        <text class="value">{{ state.status }}</text>
      </view>
      <view class="row">
        <text class="label">runCount</text>
        <text class="value mono">{{ state.runCount }}</text>
      </view>
      <button class="action" @tap="runChecks">
        重新执行校验
      </button>
    </view>

    <view class="panel">
      <view class="panel-title">
        payload
      </view>
      <text class="payload mono">{{ state.payload }}</text>
    </view>

    <view class="panel">
      <view class="panel-title">
        requestLog
      </view>
      <text class="payload mono">{{ JSON.stringify(state.requestLog) }}</text>
    </view>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 32rpx;
  background:
    radial-gradient(circle at top left, rgb(59 130 246 / 18%), transparent 34%),
    linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%);
}

.hero,
.panel {
  margin-bottom: 20rpx;
  padding: 28rpx;
  border: 2rpx solid rgb(59 130 246 / 14%);
  border-radius: 24rpx;
  background: rgb(255 255 255 / 90%);
}

.hero-title,
.panel-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #1d4ed8;
}

.hero-desc,
.label,
.value,
.payload {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #1e3a8a;
}

.row {
  margin-top: 12rpx;
}

.action {
  margin-top: 20rpx;
  color: #fff;
  background: #2563eb;
}

.mono {
  font-family: Monaco, monospace;
}
</style>
