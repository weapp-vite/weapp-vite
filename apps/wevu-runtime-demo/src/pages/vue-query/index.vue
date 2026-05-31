<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'wevu'

interface DemoPayload {
  generatedAt: string
  id: number
  label: string
  selectedTab: string
}

const queryClient = useQueryClient()
const selectedTab = ref<'overview' | 'detail'>('overview')
const refreshSeed = ref(0)

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const queryKey = computed(() => ['demo-query', selectedTab.value, refreshSeed.value] as const)

const query = useQuery({
  queryKey,
  queryFn: async (): Promise<DemoPayload> => {
    await wait(120)
    return {
      id: Math.floor(Date.now() / 1000),
      label: selectedTab.value === 'overview' ? '概览数据' : '详情数据',
      selectedTab: selectedTab.value,
      generatedAt: new Date().toISOString(),
    }
  },
})

const statusText = computed(() => {
  if (query.isPending.value) {
    return '加载中'
  }
  if (query.isFetching.value) {
    return '后台刷新中'
  }
  if (query.isError.value) {
    return '请求失败'
  }
  return '数据就绪'
})

const errorText = computed(() => {
  const error = query.error.value
  return error instanceof Error ? error.message : String(error ?? '')
})

const generatedAtText = computed(() => {
  return query.data.value?.generatedAt ?? '--'
})

async function refetchNow() {
  await query.refetch()
}

async function invalidateCurrent() {
  await queryClient.invalidateQueries({
    queryKey: ['demo-query', selectedTab.value],
  })
}

function switchTab(tab: 'overview' | 'detail') {
  selectedTab.value = tab
}

function resetCacheAndReload() {
  refreshSeed.value += 1
}
</script>

<template>
  <view class="page">
    <view class="hero">
      <text class="hero-title">
        Vue Query 接入示例
      </text>
      <text class="hero-desc">
        这里使用 @tanstack/vue-query + wevu.createApp().use() + vue-demi alias
      </text>
    </view>

    <view class="panel">
      <view class="panel-title">
        查询状态
      </view>
      <view class="row">
        <text class="label">status</text>
        <text class="value">
          {{ statusText }}
        </text>
      </view>
      <view class="row">
        <text class="label">queryKey</text>
        <text class="value mono">
          {{ JSON.stringify(queryKey) }}
        </text>
      </view>
      <view class="row">
        <text class="label">generatedAt</text>
        <text class="value mono">
          {{ generatedAtText }}
        </text>
      </view>
      <view v-if="query.data" class="payload">
        <text class="payload-title">
          最新数据
        </text>
        <text class="payload-text mono">
          {{ JSON.stringify(query.data, null, 2) }}
        </text>
      </view>
      <view v-if="query.isError" class="error-box">
        <text class="error-text">
          {{ errorText }}
        </text>
      </view>
    </view>

    <view class="panel">
      <view class="panel-title">
        操作
      </view>
      <view class="button-grid">
        <button class="action primary" @tap="() => switchTab('overview')">
          切到 overview
        </button>
        <button class="action primary" @tap="() => switchTab('detail')">
          切到 detail
        </button>
        <button class="action" @tap="refetchNow">
          立即 refetch
        </button>
        <button class="action" @tap="invalidateCurrent">
          invalidate 当前 tab
        </button>
        <button class="action" @tap="resetCacheAndReload">
          更换 queryKey
        </button>
      </view>
    </view>

    <view class="panel">
      <view class="panel-title">
        响应式标记
      </view>
      <view class="row">
        <text class="label">isPending</text>
        <text class="value">
          {{ query.isPending }}
        </text>
      </view>
      <view class="row">
        <text class="label">isFetching</text>
        <text class="value">
          {{ query.isFetching }}
        </text>
      </view>
      <view class="row">
        <text class="label">isSuccess</text>
        <text class="value">
          {{ query.isSuccess }}
        </text>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.page {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  box-sizing: border-box;
  background: #f4f4f5;
}

.hero {
  padding: 22rpx;
  border-radius: 18rpx;
  background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%);
  color: #fff;
  box-shadow: 0 14rpx 32rpx rgb(29 78 216 / 18%);
}

.hero-title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  margin-bottom: 8rpx;
}

.hero-desc {
  display: block;
  font-size: 24rpx;
  opacity: 0.88;
  line-height: 1.6;
}

.panel {
  background: #fff;
  border-radius: 18rpx;
  padding: 20rpx;
  box-shadow: 0 8rpx 24rpx rgb(15 23 42 / 6%);
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.panel-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #111827;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
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
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 16rpx;
  border-radius: 14rpx;
  background: #eff6ff;
}

.payload-title {
  font-size: 24rpx;
  font-weight: 700;
  color: #1d4ed8;
}

.payload-text {
  color: #1e293b;
  white-space: pre-wrap;
}

.error-box {
  padding: 16rpx;
  border-radius: 14rpx;
  background: #fef2f2;
}

.error-text {
  color: #b91c1c;
  font-size: 24rpx;
}

.button-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.action {
  min-height: 80rpx;
  border-radius: 14rpx;
  font-size: 24rpx;
  background: #e2e8f0;
  color: #0f172a;
}

.action.primary {
  background: #2563eb;
  color: #fff;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "navigationBarTitleText": "Vue Query",
  "navigationBarBackgroundColor": "#1d4ed8",
  "navigationBarTextStyle": "white"
}
</json>
