<script setup lang="ts">
import { io } from 'socket.io-client'
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
const defaultTransportName = ref('')
const latestRandomMessage = ref('')
const latestRandomSentAt = ref('')
const randomPushCount = ref(0)
const websocketOnlyTransportName = ref('')

interface SocketProbePayload {
  client: string
  namespace: string
  path: string
  requestCount: number
  transport: string
}

interface SocketServerRandomPayload {
  event: string
  message: string
  path: string
  requestCount: number
  sentAt: string
}

interface SocketProbeResult {
  ack: SocketProbePayload
  randomPayload: SocketServerRandomPayload
}

async function connectProbe(
  options?: {
    forceWebsocket?: boolean
  },
) {
  return await new Promise<SocketProbeResult>((resolve, reject) => {
    const socket = io(baseUrl.value, {
      autoConnect: false,
      forceNew: true,
      path: '/socket.io',
      reconnection: false,
      timeout: 10_000,
      transports: options?.forceWebsocket ? ['websocket'] : undefined,
    })

    let ackPayload: SocketProbePayload | null = null
    let randomPayload: SocketServerRandomPayload | null = null
    let settled = false
    let upgradeTimer: ReturnType<typeof setTimeout> | undefined

    const cleanup = () => {
      if (upgradeTimer) {
        clearTimeout(upgradeTimer)
      }
      socket.off('connect')
      socket.off('connect_error')
      socket.off('error')
      socket.off('server-random')
      socket.io.engine?.off('upgrade')
    }

    const resolveIfReady = () => {
      if (!ackPayload || !randomPayload) {
        return
      }
      cleanup()
      socket.disconnect()
      resolve({
        ack: ackPayload,
        randomPayload,
      })
    }

    const finalize = () => {
      if (settled) {
        return
      }
      settled = true
      const currentTransportName = socket.io.engine?.transport.name ?? ''
      if (options?.forceWebsocket) {
        websocketOnlyTransportName.value = currentTransportName
      }
      else {
        defaultTransportName.value = currentTransportName
      }
      socket.emit('probe', {
        client: 'socket.io-client',
        forceWebsocket: options?.forceWebsocket === true,
        run: state.value.runCount,
      }, (ack: SocketProbePayload) => {
        ackPayload = ack
        resolveIfReady()
      })
    }

    socket.on('server-random', (payload: SocketServerRandomPayload) => {
      randomPayload = payload
      latestRandomMessage.value = payload.message
      latestRandomSentAt.value = payload.sentAt
      randomPushCount.value = payload.requestCount
      resolveIfReady()
    })

    socket.on('connect', () => {
      if (options?.forceWebsocket || socket.io.engine?.transport.name === 'websocket') {
        finalize()
        return
      }

      socket.io.engine?.on('upgrade', () => {
        finalize()
      })
      upgradeTimer = setTimeout(() => {
        finalize()
      }, 3_000)
    })

    socket.on('connect_error', (error) => {
      cleanup()
      socket.disconnect()
      reject(error)
    })

    socket.on('error', (error) => {
      cleanup()
      socket.disconnect()
      reject(error)
    })

    socket.connect()
  })
}

async function runCase() {
  if (!baseUrl.value) {
    state.value = createErrorState(createRunningState(state.value), new Error('missing baseUrl'))
    return state.value
  }

  latestRandomMessage.value = ''
  latestRandomSentAt.value = ''
  randomPushCount.value = 0
  state.value = createRunningState(state.value)

  try {
    const defaultProbe = await connectProbe()
    const websocketOnlyProbe = await connectProbe({
      forceWebsocket: true,
    })

    if (defaultProbe.ack.client !== 'socket.io-client') {
      throw new Error(`unexpected default socket.io payload: ${JSON.stringify(defaultProbe)}`)
    }
    if (websocketOnlyProbe.ack.client !== 'socket.io-client' || websocketOnlyProbe.ack.transport !== 'websocket') {
      throw new Error(`unexpected websocket-only payload: ${JSON.stringify(websocketOnlyProbe)}`)
    }

    state.value = createSuccessState(state.value, 101, {
      checks: {
        defaultTransportSupported: defaultProbe.ack.transport === 'polling' || defaultProbe.ack.transport === 'websocket',
        serverRandomReceived: defaultProbe.randomPayload.event === 'server-random'
          && websocketOnlyProbe.randomPayload.event === 'server-random',
        websocketOnlyConnected: websocketOnlyProbe.ack.transport === 'websocket',
      },
      client: defaultProbe.ack.client,
      defaultProbe,
      latestRandomMessage: websocketOnlyProbe.randomPayload.message,
      latestRandomSentAt: websocketOnlyProbe.randomPayload.sentAt,
      path: websocketOnlyProbe.randomPayload.path,
      requestCount: websocketOnlyProbe.randomPayload.requestCount,
      transport: websocketOnlyProbe.ack.transport,
      websocketOnlyProbe,
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
    defaultTransportName: defaultTransportName.value,
    latestRandomMessage: latestRandomMessage.value,
    randomPushCount: randomPushCount.value,
    websocketOnlyTransportName: websocketOnlyTransportName.value,
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
      <text class="hero-title">socket.io-client transport</text>
      <text class="hero-desc">连接测试启动时拉起的真实 Socket.IO 服务端，验证 WebSocket 链路。</text>
    </view>

    <view class="panel">
      <text id="socket-page-status" class="line">pageStatus = {{ state.pageStatus }}</text>
      <text id="socket-status" class="line">status = {{ state.status }}</text>
      <text id="socket-run-count" class="line">runCount = {{ state.runCount }}</text>
      <text id="socket-http-status" class="line">httpStatus = {{ state.httpStatus }}</text>
      <text id="socket-request-count" class="line">requestCount = {{ state.requestCount }}</text>
      <text id="socket-request-path" class="line">requestPath = {{ state.requestPath }}</text>
      <text id="socket-default-transport" class="line">defaultTransport = {{ defaultTransportName }}</text>
      <text id="socket-websocket-transport" class="line">websocketOnlyTransport = {{ websocketOnlyTransportName }}</text>
      <text class="line">randomPushCount = {{ randomPushCount }}</text>
      <text class="line">latestRandomMessage = {{ latestRandomMessage }}</text>
      <text class="line">latestRandomSentAt = {{ latestRandomSentAt }}</text>
      <button class="action" @tap="runCase">
        重新执行 socket.io 校验
      </button>
    </view>

    <view class="panel">
      <text class="panel-title">payload</text>
      <text id="socket-payload" class="payload mono">{{ state.payload }}</text>
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
    radial-gradient(circle at top left, rgb(236 72 153 / 18%), transparent 35%),
    linear-gradient(180deg, #fdf2f8 0%, #f8fafc 100%);
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
  color: #be185d;
}

.hero-desc,
.line,
.payload {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #9d174d;
}

.action {
  margin-top: 20rpx;
  color: #fff;
  background: #db2777;
}

.error {
  border: 2rpx solid rgb(220 38 38 / 16%);
}

.mono {
  font-family: Monaco, monospace;
}
</style>
