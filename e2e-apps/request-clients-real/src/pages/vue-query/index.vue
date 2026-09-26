<script lang="ts">
import { QueryClient, useQuery } from '@tanstack/vue-query'
import { computed, defineComponent, onLoad, ref } from 'wevu'
import { resolveBaseUrl, wait } from '../../shared/runtime'

interface QueryPayload {
  generatedAt: string
  label: string
  requestCount: number
  seed: number
  tab: 'overview' | 'detail'
}

export default defineComponent({
  setup() {
    const baseUrl = ref('')
    const e2eStarted = ref(false)
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
      enabled: computed(() => Boolean(baseUrl.value) && e2eStarted.value),
      queryKey,
      queryFn: async (): Promise<QueryPayload> => {
        // eslint-disable-next-line mini-program/no-implicit-runtime-polyfill -- fixture 已启用 appPrelude.webRuntime，此处验证注入后的 fetch。
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
    const payloadLabel = computed(() => query.data.value?.label ?? '--')
    const payloadTab = computed(() => query.data.value?.tab ?? '--')
    const payloadSeed = computed(() => query.data.value?.seed ?? -1)
    const refetchCount = ref(0)

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
      refetchCount.value += 1
    }

    function startQuery() {
      e2eStarted.value = true
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

        e2eStarted.value = true
        await refetchNow()
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

    return {
      baseUrl,
      e2eStarted,
      generatedAtText,
      payloadLabel,
      payloadTab,
      payloadSeed,
      isPending: query.isPending,
      isFetching: query.isFetching,
      isSuccess: query.isSuccess,
      refetchCount,
      queryKey,
      refetchNow,
      refreshSeed,
      requestCountText,
      rotateKey,
      runE2E,
      selectedTab,
      statusText,
      startQuery,
      switchTab,
    }
  },
})
</script>

<template>
  <view id="vue-query-route" class="page" data-e2e-route="vue-query">
    <view class="hero">
      <text class="hero-title">vue-query transport</text>
      <text class="hero-desc">真实请求到本地 HTTP 服务，验证 queryKey、切 tab、refetch 与 key rotation。</text>
    </view>

    <view class="panel">
      <text id="vue-query-status" :data-e2e-status="statusText" class="line">status = {{ statusText }}</text>
      <text id="vue-query-selected-tab" class="line">selectedTab = {{ selectedTab }}</text>
      <text id="vue-query-refresh-seed" class="line">refreshSeed = {{ refreshSeed }}</text>
      <text id="vue-query-request-count" class="line">requestCount = {{ requestCountText }}</text>
      <text id="vue-query-generated-at" class="line">generatedAt = {{ generatedAtText }}</text>
      <text id="vue-query-key" class="line mono">queryKey = {{ JSON.stringify(queryKey) }}</text>
      <text id="vue-query-label" class="line">label = {{ payloadLabel }}</text>
      <text id="vue-query-payload-tab" class="line">tab = {{ payloadTab }}</text>
      <text id="vue-query-payload-seed" class="line">seed = {{ payloadSeed }}</text>
      <text id="vue-query-pending" class="line">isPending = {{ isPending }}</text>
      <text id="vue-query-fetching" class="line">isFetching = {{ isFetching }}</text>
      <text id="vue-query-success" class="line">isSuccess = {{ isSuccess }}</text>
      <text id="vue-query-refetch-count" class="line">refetchCount = {{ refetchCount }}</text>
      <button id="vue-query-start" class="action" @tap="startQuery">
        开始查询
      </button>
      <button id="vue-query-overview" class="action primary" @tap="() => switchTab('overview')">
        切到 overview
      </button>
      <button id="vue-query-detail" class="action primary" @tap="() => switchTab('detail')">
        切到 detail
      </button>
      <button id="vue-query-refetch" class="action" @tap="refetchNow">
        立即 refetch
      </button>
      <button id="vue-query-rotate" class="action" @tap="rotateKey">
        更换 queryKey
      </button>
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
