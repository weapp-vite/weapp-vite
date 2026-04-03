<script setup lang="ts">
import { onLoad, ref } from 'wevu'
import {
  createErrorState,
  createRequestCaseState,
  createRunningState,
  createSuccessState,
  resolveBaseUrl,
} from '../../shared/runtime'

const baseUrl = ref('')
const state = ref(createRequestCaseState())

async function runCase() {
  if (!baseUrl.value) {
    state.value = createErrorState(createRunningState(state.value), new Error('missing baseUrl'))
    return state.value
  }

  state.value = createRunningState(state.value)

  try {
    const { default: axios } = await import('axios')
    const requestConfig = {
      data: {
        client: 'axios',
        run: state.value.runCount,
      },
      headers: {
        'content-type': 'application/json',
      },
      method: 'post',
      url: `${baseUrl.value}/axios`,
    }

    const response = await axios.request(requestConfig)
    const payload = response.data
    if (payload.transport !== 'axios' || (payload.query?.client !== 'axios' && payload.body?.client !== 'axios')) {
      throw new Error(`unexpected axios payload: ${JSON.stringify(payload)}`)
    }
    state.value = createSuccessState(state.value, response.status, payload)
  }
  catch (error) {
    state.value = createErrorState(state.value, error)
  }

  return state.value
}

async function runE2E() {
  const snapshot = await runCase()
  return {
    baseUrl: baseUrl.value,
    ok: snapshot.pageStatus === '全部通过',
    snapshot,
  }
}

void runE2E

onLoad((query) => {
  baseUrl.value = resolveBaseUrl(query)
  void runCase()
})
</script>

<template>
  <view class="page">
    <view class="hero">
      <text class="hero-title">axios transport</text>
      <text class="hero-desc">真实请求到本地 HTTP 服务，验证 axios 在 request globals 环境中的行为。</text>
    </view>

    <view class="panel">
      <text id="axios-page-status" class="line">pageStatus = {{ state.pageStatus }}</text>
      <text id="axios-status" class="line">status = {{ state.status }}</text>
      <text id="axios-run-count" class="line">runCount = {{ state.runCount }}</text>
      <text id="axios-http-status" class="line">httpStatus = {{ state.httpStatus }}</text>
      <text id="axios-request-count" class="line">requestCount = {{ state.requestCount }}</text>
      <text id="axios-request-path" class="line">requestPath = {{ state.requestPath }}</text>
      <button class="action" @tap="runCase">
        重新执行 axios 校验
      </button>
    </view>

    <view class="panel">
      <text class="panel-title">payload</text>
      <text id="axios-payload" class="payload mono">{{ state.payload }}</text>
    </view>

    <view v-if="state.errorMessage" class="panel error">
      <text class="panel-title">error</text>
      <text class="payload mono">{{ state.errorMessage }}</text>
    </view>
  </view>
</template>

<style>
.page {
  min-height: 100vh;
  padding: 28rpx;
  background:
    radial-gradient(circle at top left, rgb(245 158 11 / 18%), transparent 35%),
    linear-gradient(180deg, #fff7ed 0%, #f8fafc 100%);
}

.hero,
.panel {
  padding: 24rpx;
  margin-bottom: 20rpx;
  background: rgb(255 255 255 / 92%);
  border-radius: 24rpx;
  box-shadow: 0 16rpx 40rpx rgb(15 23 42 / 8%);
}

.hero-title,
.panel-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #b45309;
}

.hero-desc,
.line,
.payload {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #92400e;
}

.action {
  margin-top: 20rpx;
  color: #fff;
  background: #d97706;
}

.error {
  border: 2rpx solid rgb(220 38 38 / 16%);
}

.mono {
  font-family: Monaco, monospace;
}
</style>
