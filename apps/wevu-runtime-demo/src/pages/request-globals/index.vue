<script setup lang="ts">
/* eslint-disable e18e/ban-dependencies */
import axios from 'axios'
import { request as gqlRequest } from 'graphql-request'
import { computed, onLoad, onUnload, ref } from 'wevu'

type TransportName = 'fetch' | 'graphqlRequest' | 'axios'
type TransportStatus = 'idle' | 'running' | 'success' | 'error'

interface TransportState {
  payload: string
  status: TransportStatus
}

const transportStates = ref<Record<TransportName, TransportState>>({
  fetch: { status: 'idle', payload: '' },
  graphqlRequest: { status: 'idle', payload: '' },
  axios: { status: 'idle', payload: '' },
})

const requestLog = ref<string[]>([])
const runCount = ref(0)
const pageStatus = computed(() => {
  const states = Object.values(transportStates.value)
  if (states.some(item => item.status === 'error')) {
    return '校验失败'
  }
  if (states.every(item => item.status === 'success')) {
    return '全部通过'
  }
  if (states.some(item => item.status === 'running')) {
    return '校验中'
  }
  return '待执行'
})

let originalRequest: typeof wx.request | undefined

function setTransportState(name: TransportName, patch: Partial<TransportState>) {
  transportStates.value = {
    ...transportStates.value,
    [name]: {
      ...transportStates.value[name],
      ...patch,
    },
  }
}

function createMockResponse(url: string, data: unknown) {
  if (url.endsWith('/fetch')) {
    return {
      data: JSON.stringify({
        transport: 'fetch',
        source: 'request-globals',
        echo: data ?? null,
      }),
      header: {
        'content-type': 'application/json',
      },
      statusCode: 200,
    }
  }

  if (url.endsWith('/axios')) {
    return {
      data: JSON.stringify({
        transport: 'axios',
        source: 'request-globals',
      }),
      header: {
        'content-type': 'application/json',
      },
      statusCode: 200,
    }
  }

  if (url.endsWith('/graphql')) {
    return {
      data: JSON.stringify({
        data: {
          transport: {
            client: 'graphql-request',
            source: 'request-globals',
          },
        },
      }),
      header: {
        'content-type': 'application/json',
      },
      statusCode: 200,
    }
  }

  return {
    errMsg: `mock fail: unsupported url ${url}`,
  }
}

function installMockRequest() {
  if (originalRequest) {
    return
  }

  originalRequest = wx.request
  ;(wx as typeof wx & { request: typeof wx.request }).request = ((options: WechatMiniprogram.RequestOption) => {
    const method = String(options.method ?? 'GET').toUpperCase()
    const url = String(options.url ?? '')
    requestLog.value = [...requestLog.value, `${method} ${url}`]

    const timer = setTimeout(() => {
      const result = createMockResponse(url, options.data)
      if ('statusCode' in result) {
        options.success?.(result as WechatMiniprogram.RequestSuccessCallbackResult)
        options.complete?.(result as WechatMiniprogram.RequestSuccessCallbackResult)
        return
      }
      options.fail?.(result)
      options.complete?.(result)
    }, 18)

    return {
      abort() {
        clearTimeout(timer)
        const aborted = {
          errMsg: 'request:fail abort',
        }
        options.fail?.(aborted)
        options.complete?.(aborted)
      },
      offChunkReceived() {},
      onChunkReceived() {},
    } as WechatMiniprogram.RequestTask
  }) as typeof wx.request
}

function restoreMockRequest() {
  if (!originalRequest) {
    return
  }
  ;(wx as typeof wx & { request: typeof wx.request }).request = originalRequest
  originalRequest = undefined
}

async function runFetchCase() {
  setTransportState('fetch', { status: 'running', payload: '' })
  try {
    const response = await fetch('https://request-globals.test/fetch', {
      method: 'POST',
      body: JSON.stringify({ run: runCount.value }),
    })
    const payload = await response.json()
    setTransportState('fetch', {
      status: payload.transport === 'fetch' ? 'success' : 'error',
      payload: JSON.stringify(payload),
    })
  }
  catch (error) {
    setTransportState('fetch', {
      status: 'error',
      payload: error instanceof Error ? error.message : String(error),
    })
  }
}

async function runGraphqlRequestCase() {
  setTransportState('graphqlRequest', { status: 'running', payload: '' })
  try {
    const payload = await gqlRequest<{ transport: { client: string, source: string } }>(
      'https://request-globals.test/graphql',
      /* GraphQL */ `
        query RequestGlobalsTransport {
          transport {
            client
            source
          }
        }
      `,
    )
    setTransportState('graphqlRequest', {
      status: payload.transport.client === 'graphql-request' ? 'success' : 'error',
      payload: JSON.stringify(payload),
    })
  }
  catch (error) {
    setTransportState('graphqlRequest', {
      status: 'error',
      payload: error instanceof Error ? error.message : String(error),
    })
  }
}

async function runAxiosCase() {
  setTransportState('axios', { status: 'running', payload: '' })
  try {
    const payload = await axios.get('https://request-globals.test/axios')
    setTransportState('axios', {
      status: payload.data?.transport === 'axios' ? 'success' : 'error',
      payload: JSON.stringify(payload.data),
    })
  }
  catch (error) {
    setTransportState('axios', {
      status: 'error',
      payload: error instanceof Error ? error.message : String(error),
    })
  }
}

async function runChecks() {
  runCount.value += 1
  requestLog.value = []
  await runFetchCase()
  await runGraphqlRequestCase()
  await runAxiosCase()
}

onLoad(() => {
  installMockRequest()
  void runChecks()
})

onUnload(() => {
  restoreMockRequest()
})
</script>

<template>
  <view class="page">
    <view class="hero">
      <text class="hero-title">Request Globals 兼容验证</text>
      <text class="hero-desc">
        在模拟器里同时验证 fetch、graphql-request、axios 三条请求链路
      </text>
    </view>

    <view class="panel">
      <view class="row">
        <text class="label">pageStatus</text>
        <text class="value">{{ pageStatus }}</text>
      </view>
      <view class="row">
        <text class="label">runCount</text>
        <text class="value mono">{{ runCount }}</text>
      </view>
      <button class="action" @tap="runChecks">
        重新执行校验
      </button>
    </view>

    <view class="panel">
      <view class="panel-title">
        fetch
      </view>
      <view class="row">
        <text class="label">status</text>
        <text class="value">{{ transportStates.fetch.status }}</text>
      </view>
      <text class="payload mono">{{ transportStates.fetch.payload }}</text>
    </view>

    <view class="panel">
      <view class="panel-title">
        graphql-request
      </view>
      <view class="row">
        <text class="label">status</text>
        <text class="value">{{ transportStates.graphqlRequest.status }}</text>
      </view>
      <text class="payload mono">{{ transportStates.graphqlRequest.payload }}</text>
    </view>

    <view class="panel">
      <view class="panel-title">
        axios
      </view>
      <view class="row">
        <text class="label">status</text>
        <text class="value">{{ transportStates.axios.status }}</text>
      </view>
      <text class="payload mono">{{ transportStates.axios.payload }}</text>
    </view>

    <view class="panel">
      <view class="panel-title">
        request log
      </view>
      <text class="payload mono">{{ JSON.stringify(requestLog) }}</text>
    </view>
  </view>
</template>

<style>
.page {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  padding: 24rpx;
  box-sizing: border-box;
  background: #f4f4f5;
}

.hero {
  padding: 22rpx;
  border-radius: 18rpx;
  background: linear-gradient(135deg, #0f172a 0%, #0f766e 100%);
  color: #fff;
  box-shadow: 0 14rpx 32rpx rgb(15 118 110 / 18%);
}

.hero-title {
  display: block;
  margin-bottom: 8rpx;
  font-size: 34rpx;
  font-weight: 700;
}

.hero-desc {
  display: block;
  font-size: 24rpx;
  line-height: 1.6;
  opacity: 0.9;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  padding: 20rpx;
  border-radius: 18rpx;
  background: #fff;
  box-shadow: 0 8rpx 24rpx rgb(15 23 42 / 6%);
}

.panel-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #111827;
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
}

.label {
  flex: 0 0 180rpx;
  font-size: 24rpx;
  color: #64748b;
}

.value {
  flex: 1;
  text-align: right;
  font-size: 24rpx;
  color: #0f172a;
}

.mono {
  font-family: Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 22rpx;
}

.payload {
  color: #0f172a;
  word-break: break-all;
}

.action {
  border-radius: 999rpx;
  background: #0f766e;
  color: #fff;
  font-size: 24rpx;
}
</style>
