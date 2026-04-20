<script setup lang="ts">
import { QueryClient, useQuery } from '@tanstack/vue-query'
import { computed, onLoad, ref } from 'wevu'
import { resolveBaseUrl, wait } from '../../shared/runtime'

interface QueryPayload {
  generatedAt: string
  label: string
  requestCount: number
  seed: number
  tab: 'overview' | 'detail'
}

const baseUrl = ref('')
const selectedTab = ref<'overview' | 'detail'>('overview')
const refreshSeed = ref(0)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 5 * 60 * 1000,
      retry: false,
      staleTime: 0,
    },
  },
})

queryClient.mount()

const queryKey = computed(() => ['request-clients-real', selectedTab.value, refreshSeed.value] as const)

const query = useQuery({
  enabled: computed(() => Boolean(baseUrl.value)),
  queryKey,
  queryFn: async (): Promise<QueryPayload> => {
    const response = await fetch(
      `${baseUrl.value}/vue-query?tab=${selectedTab.value}&seed=${refreshSeed.value}`,
    )
    if (!response.ok) {
      throw new Error(`request failed with ${response.status}`)
    }
    return await response.json()
  },
  retry: false,
}, queryClient)

const statusText = computed(() => {
  if (query.isPending.value) {
    return '加载中'
  }
  if (query.isFetching.value) {
    return '刷新中'
  }
  if (query.isError.value) {
    return '失败'
  }
  return '数据就绪'
})

const requestCountText = computed(() => query.data.value?.requestCount ?? 0)
const generatedAtText = computed(() => query.data.value?.generatedAt ?? '--')
const errorText = computed(() => {
  const error = query.error.value
  return error instanceof Error ? error.message : String(error ?? '')
})

async function waitForReady(tab = selectedTab.value, seed = refreshSeed.value, minRequestCount = 1) {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= 15_000) {
    const data = query.data.value
    if (
      query.isSuccess.value
      && data
      && data.tab === tab
      && data.seed === seed
      && data.requestCount >= minRequestCount
    ) {
      return data
    }
    await wait(120)
  }
  throw new Error(`timed out waiting for vue-query state: tab=${tab}, seed=${seed}`)
}

async function refetchNow() {
  await query.refetch()
}

function switchTab(tab: 'overview' | 'detail') {
  selectedTab.value = tab
}

function rotateKey() {
  refreshSeed.value += 1
}

async function runE2E() {
  try {
    if (!baseUrl.value) {
      throw new Error('missing baseUrl')
    }

    const initial = await waitForReady('overview', 0, 1)
    switchTab('detail')
    const detail = await waitForReady('detail', 0, 1)
    const beforeRefetchCount = detail.requestCount
    await refetchNow()
    const afterRefetch = await waitForReady('detail', 0, beforeRefetchCount + 1)
    rotateKey()
    const afterRotate = await waitForReady('detail', 1, afterRefetch.requestCount + 1)

    return {
      baseUrl: baseUrl.value,
      ok: true,
      checks: {
        initialOverview: initial.tab === 'overview' && initial.label === 'Overview Data',
        switchedDetail: detail.tab === 'detail' && detail.label === 'Detail Data',
        refetchAdvanced: afterRefetch.requestCount > beforeRefetchCount,
        keyRotated: afterRotate.seed === 1 && afterRotate.requestCount > afterRefetch.requestCount,
      },
      snapshots: {
        initial,
        detail,
        afterRefetch,
        afterRotate,
      },
    }
  }
  catch (error) {
    return {
      baseUrl: baseUrl.value,
      errorMessage: error instanceof Error ? error.message : String(error ?? ''),
      ok: false,
      statusText: statusText.value,
      queryData: query.data.value,
      queryKey: queryKey.value,
      refreshSeed: refreshSeed.value,
      selectedTab: selectedTab.value,
    }
  }
}

void runE2E

onLoad((queryOptions) => {
  baseUrl.value = resolveBaseUrl(queryOptions)
})
</script>

<template>
  <view class="page">
    <view class="hero">
      <text class="hero-title">vue-query transport</text>
      <text class="hero-desc">真实请求到本地 HTTP 服务，验证 queryKey、切 tab、refetch 与 key rotation。</text>
    </view>

    <view class="panel">
      <text id="vue-query-status" class="line">status = {{ statusText }}</text>
      <text id="vue-query-selected-tab" class="line">selectedTab = {{ selectedTab }}</text>
      <text id="vue-query-refresh-seed" class="line">refreshSeed = {{ refreshSeed }}</text>
      <text id="vue-query-request-count" class="line">requestCount = {{ requestCountText }}</text>
      <text id="vue-query-generated-at" class="line">generatedAt = {{ generatedAtText }}</text>
      <text id="vue-query-key" class="line mono">queryKey = {{ JSON.stringify(queryKey) }}</text>
      <button class="action primary" @tap="() => switchTab('overview')">
        切到 overview
      </button>
      <button class="action primary" @tap="() => switchTab('detail')">
        切到 detail
      </button>
      <button class="action" @tap="refetchNow">
        立即 refetch
      </button>
      <button class="action" @tap="rotateKey">
        更换 queryKey
      </button>
    </view>

    <view class="panel">
      <text class="panel-title">payload</text>
      <text id="vue-query-payload" class="payload mono">{{ JSON.stringify(query.data) }}</text>
    </view>

    <view v-if="query.isError" class="panel error">
      <text class="panel-title">error</text>
      <text class="payload mono">{{ errorText }}</text>
    </view>
  </view>
</template>

<style>
.page {
  min-height: 100vh;
  padding: 28rpx;
  background:
    radial-gradient(circle at top left, rgb(139 92 246 / 18%), transparent 35%),
    linear-gradient(180deg, #f5f3ff 0%, #f8fafc 100%);
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
  color: #6d28d9;
}

.hero-desc,
.line,
.payload {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #5b21b6;
}

.action {
  margin-top: 16rpx;
  color: #fff;
  background: #7c3aed;
}

.primary {
  background: #6d28d9;
}

.error {
  border: 2rpx solid rgb(220 38 38 / 16%);
}

.mono {
  font-family: Monaco, monospace;
}
</style>
