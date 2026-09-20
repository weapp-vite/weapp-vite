<script setup lang="ts">
import { onLoad, ref } from 'wevu'
import { waitForRequestClientsRealWebSocketProbe } from '../../../../../e2e/utils/requestClientsRealWebSocketProbe'
import {
  createErrorState,
  createRequestCaseState,
  createRunningState,
  createSuccessState,
  resolveBaseUrl,
} from '../../shared/runtime'

const HTTP_PROTOCOL_RE = /^http/u

const baseUrl = ref('')
const state = ref(createRequestCaseState())
const websocketUrl = ref('')
const connectedReadyState = ref(-1)
const finalReadyState = ref(-1)
const echoStage = ref('')
const echoRun = ref(0)
const latestRandomMessage = ref('')
const latestRandomSentAt = ref('')
const randomPushCount = ref(0)

async function runCase() {
  if (!baseUrl.value) {
    state.value = createErrorState(createRunningState(state.value), new Error('missing baseUrl'))
    return state.value
  }

  state.value = createRunningState(state.value)
  connectedReadyState.value = -1
  finalReadyState.value = -1
  echoStage.value = ''
  echoRun.value = 0

  try {
    websocketUrl.value = `${baseUrl.value.replace(HTTP_PROTOCOL_RE, 'ws')}/ws`
    latestRandomMessage.value = ''
    latestRandomSentAt.value = ''
    randomPushCount.value = 0

    // eslint-disable-next-line mini-program/no-implicit-runtime-polyfill -- fixture 已启用 appPrelude.webRuntime，此处验证注入后的 WebSocket。
    const socket = new WebSocket(websocketUrl.value)
    const payload = await waitForRequestClientsRealWebSocketProbe(socket, state.value.runCount)
    connectedReadyState.value = payload.connectedReadyState
    finalReadyState.value = payload.finalReadyState
    echoStage.value = payload.echoPayload.stage
    echoRun.value = Number(payload.echoPayload.body?.run)
    latestRandomMessage.value = payload.tickPayload.message ?? ''
    latestRandomSentAt.value = payload.tickPayload.sentAt ?? ''
    randomPushCount.value = payload.tickPayload.requestCount

    if (payload.echoPayload.client !== 'native-websocket' || payload.echoPayload.transport !== 'websocket') {
      throw new Error(`unexpected websocket payload: ${JSON.stringify(payload)}`)
    }

    state.value = createSuccessState(state.value, 101, {
      client: payload.echoPayload.client,
      latestRandomMessage: payload.tickPayload.message ?? '',
      latestRandomSentAt: payload.tickPayload.sentAt ?? '',
      path: payload.tickPayload.path,
      requestCount: payload.tickPayload.requestCount,
      serverRandomEvent: payload.tickPayload.event ?? '',
      transport: payload.echoPayload.transport,
      body: payload.echoPayload.body,
      stage: payload.echoPayload.stage,
      tickPayload: payload.tickPayload,
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
    connectedReadyState: connectedReadyState.value,
    finalReadyState: finalReadyState.value,
    latestRandomMessage: latestRandomMessage.value,
    ok: snapshot.pageStatus === '全部通过',
    randomPushCount: randomPushCount.value,
    snapshot,
    websocketUrl: websocketUrl.value,
  }
}

void runE2E

onLoad((query) => {
  baseUrl.value = resolveBaseUrl(query)
})
</script>

<template>
  <view id="websocket-route" class="page" data-e2e-route="websocket">
    <view class="hero">
      <text class="hero-title">native WebSocket transport</text>
      <text class="hero-desc">连接测试启动时拉起的真实 WebSocket 服务端，验证 weapp-vite 注入的 WebSocket 对象。</text>
    </view>

    <view class="panel">
      <text id="websocket-page-status" class="line">pageStatus = {{ state.pageStatus }}</text>
      <text id="websocket-status" :data-e2e-status="state.status" class="line">status = {{ state.status }}</text>
      <text id="websocket-run-count" class="line">runCount = {{ state.runCount }}</text>
      <text id="websocket-http-status" class="line">httpStatus = {{ state.httpStatus }}</text>
      <text id="websocket-request-count" class="line">requestCount = {{ state.requestCount }}</text>
      <text id="websocket-request-path" class="line">requestPath = {{ state.requestPath }}</text>
      <text id="websocket-response-client" class="line">client = {{ state.response.client }}</text>
      <text id="websocket-response-transport" class="line">transport = {{ state.response.transport }}</text>
      <text id="websocket-response-method" class="line">method = {{ state.response.method }}</text>
      <text id="websocket-response-operationName" class="line">operationName = {{ state.response.operationName }}</text>
      <text id="websocket-response-event" class="line">event = {{ state.response.event }}</text>
      <text id="websocket-connected-ready-state" class="line">connectedReadyState = {{ connectedReadyState }}</text>
      <text id="websocket-echo-stage" class="line">echoStage = {{ echoStage }}</text>
      <text id="websocket-echo-run" class="line">echoRun = {{ echoRun }}</text>
      <text id="websocket-final-ready-state" class="line">finalReadyState = {{ finalReadyState }}</text>
      <text class="line">randomPushCount = {{ randomPushCount }}</text>
      <text class="line">latestRandomMessageReady = {{ latestRandomMessage ? 'yes' : 'no' }}</text>
      <text class="line">latestRandomSentAtReady = {{ latestRandomSentAt ? 'yes' : 'no' }}</text>
      <text id="websocket-url" class="line">websocketReady = {{ websocketUrl ? 'yes' : 'no' }}</text>
      <button class="action" @tap="runCase">
        重新执行 websocket 校验
      </button>
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
    radial-gradient(circle at top left, rgb(14 165 233 / 18%), transparent 35%),
    linear-gradient(180deg, #ecfeff 0%, #f8fafc 100%);
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
  color: #0369a1;
}

.hero-desc,
.line,
.payload {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #0f766e;
}

.action {
  margin-top: 20rpx;
  color: #fff;
  background: #0284c7;
}

.error {
  border: 2rpx solid rgb(220 38 38 / 16%);
}

.mono {
  font-family: Monaco, monospace;
}
</style>
