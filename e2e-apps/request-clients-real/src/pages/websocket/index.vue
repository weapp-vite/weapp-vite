<script setup lang="ts">
import { onLoad, ref } from 'wevu'
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

interface NativeWebSocketPayload {
  body?: Record<string, unknown>
  client: string
  path: string
  requestCount: number
  stage: string
  transport?: string
  url?: string
}

async function runCase() {
  if (!baseUrl.value) {
    state.value = createErrorState(createRunningState(state.value), new Error('missing baseUrl'))
    return state.value
  }

  state.value = createRunningState(state.value)

  try {
    websocketUrl.value = `${baseUrl.value.replace(HTTP_PROTOCOL_RE, 'ws')}/ws`

    const payload = await new Promise<NativeWebSocketPayload>((resolve, reject) => {
      const socket = new WebSocket(websocketUrl.value)
      let settled = false
      let welcomeReceived = false

      const cleanup = () => {
        socket.onopen = null
        socket.onmessage = null
        socket.onerror = null
        socket.onclose = null
      }

      const finalize = (handler: () => void) => {
        if (settled) {
          return
        }
        settled = true
        cleanup()
        handler()
      }

      socket.onopen = () => {
        connectedReadyState.value = socket.readyState
        socket.send(JSON.stringify({
          client: 'native-websocket',
          run: state.value.runCount,
        }))
      }

      socket.onmessage = (event) => {
        const data = typeof event.data === 'string' ? event.data : ''
        const parsed = JSON.parse(data) as NativeWebSocketPayload
        if (!welcomeReceived) {
          welcomeReceived = true
          return
        }

        finalReadyState.value = socket.readyState
        finalize(() => {
          socket.close()
          resolve(parsed)
        })
      }

      socket.onerror = (error) => {
        finalize(() => {
          socket.close()
          reject(error)
        })
      }

      socket.onclose = () => {
        finalReadyState.value = socket.readyState
      }
    })

    if (payload.client !== 'native-websocket' || payload.transport !== 'websocket') {
      throw new Error(`unexpected websocket payload: ${JSON.stringify(payload)}`)
    }

    state.value = createSuccessState(state.value, 101, payload)
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
    ok: snapshot.pageStatus === '全部通过',
    snapshot,
    websocketUrl: websocketUrl.value,
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
      <text class="hero-title">native WebSocket transport</text>
      <text class="hero-desc">连接测试启动时拉起的真实 WebSocket 服务端，验证 weapp-vite 注入的 WebSocket 对象。</text>
    </view>

    <view class="panel">
      <text id="websocket-page-status" class="line">pageStatus = {{ state.pageStatus }}</text>
      <text id="websocket-status" class="line">status = {{ state.status }}</text>
      <text id="websocket-run-count" class="line">runCount = {{ state.runCount }}</text>
      <text id="websocket-http-status" class="line">httpStatus = {{ state.httpStatus }}</text>
      <text id="websocket-request-count" class="line">requestCount = {{ state.requestCount }}</text>
      <text id="websocket-request-path" class="line">requestPath = {{ state.requestPath }}</text>
      <text id="websocket-connected-ready-state" class="line">connectedReadyState = {{ connectedReadyState }}</text>
      <text id="websocket-final-ready-state" class="line">finalReadyState = {{ finalReadyState }}</text>
      <text id="websocket-url" class="line">websocketUrl = {{ websocketUrl }}</text>
      <button class="action" @tap="runCase">
        重新执行 websocket 校验
      </button>
    </view>

    <view class="panel">
      <text class="panel-title">payload</text>
      <text id="websocket-payload" class="payload mono">{{ state.payload }}</text>
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
