<script setup lang="ts">
import { request } from 'graphql-request'
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
    const payload = await request<{
      transport: {
        client: string
        path: string
        requestCount: number
        operationName: string
      }
    }>(
      `${baseUrl.value}/graphql`,
      /* GraphQL */ `
        query TransportProbe($run: Int!) {
          transport(run: $run) {
            client
            path
            requestCount
            operationName
          }
        }
      `,
      {
        run: state.value.runCount,
      },
    )
    if (payload.transport.client !== 'graphql-request') {
      throw new Error(`unexpected graphql payload: ${JSON.stringify(payload)}`)
    }
    state.value = createSuccessState(state.value, 200, {
      ...payload.transport,
      path: payload.transport.path,
      requestCount: payload.transport.requestCount,
    })
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
      <text class="hero-title">graphql-request transport</text>
      <text class="hero-desc">真实请求到本地 GraphQL 服务，验证 URL / fetch / body 传递链路。</text>
    </view>

    <view class="panel">
      <text id="graphql-page-status" class="line">pageStatus = {{ state.pageStatus }}</text>
      <text id="graphql-status" class="line">status = {{ state.status }}</text>
      <text id="graphql-run-count" class="line">runCount = {{ state.runCount }}</text>
      <text id="graphql-http-status" class="line">httpStatus = {{ state.httpStatus }}</text>
      <text id="graphql-request-count" class="line">requestCount = {{ state.requestCount }}</text>
      <text id="graphql-request-path" class="line">requestPath = {{ state.requestPath }}</text>
      <button class="action" @tap="runCase">
        重新执行 GraphQL 校验
      </button>
    </view>

    <view class="panel">
      <text class="panel-title">payload</text>
      <text id="graphql-payload" class="payload mono">{{ state.payload }}</text>
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
    radial-gradient(circle at top left, rgb(16 185 129 / 18%), transparent 35%),
    linear-gradient(180deg, #ecfdf5 0%, #f8fafc 100%);
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
  color: #047857;
}

.hero-desc,
.line,
.payload {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #065f46;
}

.action {
  margin-top: 20rpx;
  color: #fff;
  background: #059669;
}

.error {
  border: 2rpx solid rgb(220 38 38 / 16%);
}

.mono {
  font-family: Monaco, monospace;
}
</style>
