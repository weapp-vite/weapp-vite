<script setup lang="ts">
import { onLoad, ref } from 'wevu'
import {
  createErrorState,
  createRequestCaseState,
  createRunningState,
  createSuccessState,
  ensureRequestGlobalsHost,
  resolveBaseUrl,
} from '../../shared/runtime'

const baseUrl = ref('')
const state = ref(createRequestCaseState())
const requestHost = ensureRequestGlobalsHost()

async function runCase() {
  if (!baseUrl.value) {
    state.value = createErrorState(createRunningState(state.value), new Error('missing baseUrl'))
    return state.value
  }

  state.value = createRunningState(state.value)

  try {
    const response = await requestHost.fetch(`${baseUrl.value}/fetch`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        client: 'fetch',
        run: state.value.runCount,
      }),
    })
    const payload = await response.json()
    if (payload.transport !== 'fetch' || payload.method !== 'POST') {
      throw new Error(`unexpected fetch payload: ${JSON.stringify(payload)}`)
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
      <text class="hero-title">fetch transport</text>
      <text class="hero-desc">真实请求到本地 HTTP 服务，验证 fetch + request globals。</text>
    </view>

    <view class="panel">
      <text id="fetch-page-status" class="line">pageStatus = {{ state.pageStatus }}</text>
      <text id="fetch-status" class="line">status = {{ state.status }}</text>
      <text id="fetch-run-count" class="line">runCount = {{ state.runCount }}</text>
      <text id="fetch-http-status" class="line">httpStatus = {{ state.httpStatus }}</text>
      <text id="fetch-request-count" class="line">requestCount = {{ state.requestCount }}</text>
      <text id="fetch-request-path" class="line">requestPath = {{ state.requestPath }}</text>
      <button class="action" @tap="runCase">
        重新执行 fetch 校验
      </button>
    </view>

    <view class="panel">
      <text class="panel-title">payload</text>
      <text id="fetch-payload" class="payload mono">{{ state.payload }}</text>
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
    radial-gradient(circle at top left, rgb(59 130 246 / 18%), transparent 35%),
    linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%);
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
  color: #1d4ed8;
}

.hero-desc,
.line,
.payload {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #1e3a8a;
}

.action {
  margin-top: 20rpx;
  color: #fff;
  background: #2563eb;
}

.error {
  border: 2rpx solid rgb(220 38 38 / 16%);
}

.mono {
  font-family: Monaco, monospace;
}
</style>
