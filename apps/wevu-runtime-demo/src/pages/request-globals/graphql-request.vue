<script setup lang="ts">
import { request as gqlRequest } from 'graphql-request'
import { onLoad, onUnload, ref } from 'wevu'
import {
  installWebRuntimeGlobals,
  resetMiniProgramNetworkDefaults,
} from 'wevu/web-apis'
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
    const payload = await gqlRequest<{ transport: { client: string, source: string } }>(
      'https://request-globals.invalid/graphql',
      /* GraphQL */ `
        query RequestGlobalsTransport {
          transport {
            client
            source
          }
        }
      `,
    )
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
  installWebRuntimeGlobals({
    networkDefaults: {
      request: {
        enableChunked: true,
        timeout: 4_800,
      },
    },
    targets: ['fetch', 'Headers', 'Request', 'Response', 'AbortController', 'AbortSignal'],
  })
  void runChecks()
})

onUnload(() => {
  resetMiniProgramNetworkDefaults()
  restoreMockRequest()
})
</script>

<template>
  <view class="page">
    <view class="hero">
      <text class="hero-title">graphql-request 验证</text>
      <text class="hero-desc">验证 `wevu/web-apis` 子路径导出的 web runtime installer 与 URL / fetch 组合兼容。</text>
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
    radial-gradient(circle at top left, rgb(16 185 129 / 18%), transparent 34%),
    linear-gradient(180deg, #ecfdf5 0%, #f8fafc 100%);
}

.hero,
.panel {
  padding: 28rpx;
  margin-bottom: 20rpx;
  background: rgb(255 255 255 / 90%);
  border: 2rpx solid rgb(16 185 129 / 14%);
  border-radius: 24rpx;
}

.hero-title,
.panel-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #047857;
}

.hero-desc,
.label,
.value,
.payload {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #065f46;
}

.row {
  margin-top: 12rpx;
}

.action {
  margin-top: 20rpx;
  color: #fff;
  background: #059669;
}

.mono {
  font-family: Monaco, monospace;
}
</style>
