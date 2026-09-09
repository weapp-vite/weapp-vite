<script setup lang="ts">
import type { QueryListKey, QueryListPayload } from '../../shared/queryFixture'
import { useQuery } from '@wevu/query'
import { computed, onLoad, shallowRef } from 'wevu'
import {
  createQueryListKey,
  fetchQueryList,

  readRouteParameter,
} from '../../shared/queryFixture'

definePageJson({
  navigationBarTitleText: 'query list',
})

const baseUrl = shallowRef('')
const filter = shallowRef('')
const routeError = shallowRef('')

const queryOptions = {
  enabled: () => Boolean(baseUrl.value && filter.value),
  key: () => createQueryListKey(baseUrl.value, filter.value),
  // fixture 故意不向 wx.request 转发 signal，用真实旧响应覆盖 key 隔离。
  query: ({ key }: { key: QueryListKey }) => fetchQueryList(key[2], key[3]),
  refetchOnShow: 'stale' as const,
  staleTime: 60_000,
}

const {
  data: primaryData,
  error: primaryError,
  fetchStatus: primaryFetchStatus,
  hasData: primaryHasData,
  invalidated: primaryInvalidated,
} = useQuery(queryOptions)
const {
  data: secondaryData,
  error: secondaryError,
  fetchStatus: secondaryFetchStatus,
  hasData: secondaryHasData,
  invalidated: secondaryInvalidated,
} = useQuery(queryOptions)

function formatPayload(payload: QueryListPayload | undefined) {
  if (!payload) {
    return 'pending'
  }
  const item = payload.items[0]
  return `${payload.filter}|revision:${payload.revision}|request:${payload.requestId}|item:${item?.title ?? 'none'}`
}

const primaryResult = computed(() => formatPayload(primaryData.value))
const secondaryResult = computed(() => formatPayload(secondaryData.value))
const statusText = computed(() => {
  if (routeError.value) {
    return 'route-error'
  }
  if (primaryError.value || secondaryError.value) {
    return 'error'
  }
  if (!primaryHasData.value || !secondaryHasData.value) {
    return 'loading'
  }
  if (primaryFetchStatus.value === 'fetching' || secondaryFetchStatus.value === 'fetching') {
    return 'refreshing'
  }
  return 'success'
})
const errorText = computed(() => {
  const error = primaryError.value ?? secondaryError.value
  return routeError.value || (error instanceof Error ? error.message : error ? String(error) : '')
})
const invalidatedText = computed(() => String(primaryInvalidated.value || secondaryInvalidated.value))

onLoad((query) => {
  baseUrl.value = readRouteParameter(query, 'baseUrl')
  filter.value = readRouteParameter(query, 'filter') || 'all'
  routeError.value = baseUrl.value ? '' : 'missing baseUrl'
})

function openDetail() {
  if (!baseUrl.value) {
    routeError.value = 'missing baseUrl'
    return
  }
  wx.navigateTo({
    url: `/pages/query-detail/index?baseUrl=${encodeURIComponent(baseUrl.value)}&itemId=1`,
  })
}

function useSlowKey() {
  filter.value = 'slow'
}

function useFastKey() {
  filter.value = 'fast'
}
</script>

<template>
  <view
    id="query-list-ready"
    class="query-list"
    :data-filter="filter"
    :data-invalidated="invalidatedText"
    :data-status="statusText"
  >
    <view class="query-list__title">
      @wevu/query list fixture
    </view>
    <view id="query-list-status" class="query-list__status">
      {{ statusText }}
    </view>
    <view id="query-primary-result" class="query-list__result">
      {{ primaryResult }}
    </view>
    <view id="query-secondary-result" class="query-list__result">
      {{ secondaryResult }}
    </view>
    <view v-if="errorText" id="query-list-error" class="query-list__error">
      {{ errorText }}
    </view>
    <view id="query-open-detail" class="query-list__button" @tap="openDetail">
      open detail
    </view>
    <view id="query-use-slow" class="query-list__button" @tap="useSlowKey">
      use slow key
    </view>
    <view id="query-use-fast" class="query-list__button" @tap="useFastKey">
      use fast key
    </view>
  </view>
</template>

<style scoped>
.query-list {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #f8fafc;
}

.query-list__title {
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.query-list__status,
.query-list__result,
.query-list__error,
.query-list__button {
  padding: 16rpx;
  margin-top: 16rpx;
  font-size: 24rpx;
  border-radius: 12rpx;
}

.query-list__status,
.query-list__result {
  color: #1e293b;
  background: #e2e8f0;
}

.query-list__error {
  color: #991b1b;
  background: #fee2e2;
}

.query-list__button {
  color: #fff;
  text-align: center;
  background: #2563eb;
}
</style>
