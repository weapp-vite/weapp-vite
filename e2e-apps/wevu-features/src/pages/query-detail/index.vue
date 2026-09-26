<script setup lang="ts">
import type { QueryMutationVariables } from '../../shared/queryFixture'
import { useMutation, useQueryClient } from '@wevu/query'
import { computed, onLoad, shallowRef } from 'wevu'
import {
  QUERY_LIST_KEY_PREFIX,

  readRouteParameter,
  updateQueryItem,
} from '../../shared/queryFixture'

definePageJson({
  navigationBarTitleText: 'query detail',
})

const baseUrl = shallowRef('')
const itemId = shallowRef('')
const routeError = shallowRef('')
const queryClient = useQueryClient()

const {
  data: mutationData,
  error: mutationError,
  isPending,
  mutate,
  status: mutationStatus,
} = useMutation({
  mutation: (variables: QueryMutationVariables) => updateQueryItem(baseUrl.value, variables),
  onSuccess: async () => {
    await queryClient.invalidateQueries({ key: QUERY_LIST_KEY_PREFIX })
  },
})

const mutationStatusText = computed(() => {
  if (routeError.value) {
    return 'route-error'
  }
  return mutationStatus.value
})
const mutationResultText = computed(() => {
  const payload = mutationData.value
  return payload ? `${payload.id}|revision:${payload.revision}` : 'none'
})
const errorText = computed(() => {
  const error = mutationError.value
  return routeError.value || (error instanceof Error ? error.message : error ? String(error) : '')
})

onLoad((query) => {
  baseUrl.value = readRouteParameter(query, 'baseUrl')
  itemId.value = readRouteParameter(query, 'itemId') || '1'
  routeError.value = baseUrl.value ? '' : 'missing baseUrl'
})

function saveItem() {
  if (!baseUrl.value || isPending.value) {
    return
  }
  mutate({ id: itemId.value })
}

function goBack() {
  wx.navigateBack({ delta: 1 })
}
</script>

<template>
  <view
    id="query-detail-ready"
    class="query-detail"
    :data-item-id="itemId"
    :data-status="mutationStatusText"
  >
    <view class="query-detail__title">
      @wevu/query mutation fixture
    </view>
    <view id="query-detail-item" class="query-detail__value">
      {{ itemId }}
    </view>
    <view id="query-mutation-status" class="query-detail__value">
      {{ mutationStatusText }}
    </view>
    <view id="query-mutation-result" class="query-detail__value">
      {{ mutationResultText }}
    </view>
    <view v-if="errorText" id="query-mutation-error" class="query-detail__error">
      {{ errorText }}
    </view>
    <view id="query-mutate" class="query-detail__button" @tap="saveItem">
      save item
    </view>
    <view id="query-detail-back" class="query-detail__button query-detail__button--secondary" @tap="goBack">
      navigate back
    </view>
  </view>
</template>

<style scoped>
.query-detail {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #fff7ed;
}

.query-detail__title {
  font-size: 32rpx;
  font-weight: 700;
  color: #7c2d12;
}

.query-detail__value,
.query-detail__error,
.query-detail__button {
  padding: 16rpx;
  margin-top: 16rpx;
  font-size: 24rpx;
  border-radius: 12rpx;
}

.query-detail__value {
  color: #431407;
  background: #ffedd5;
}

.query-detail__error {
  color: #991b1b;
  background: #fee2e2;
}

.query-detail__button {
  color: #fff;
  text-align: center;
  background: #ea580c;
}

.query-detail__button--secondary {
  background: #475569;
}
</style>
