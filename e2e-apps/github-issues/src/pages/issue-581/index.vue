<script setup lang="ts">
import { reactive, ref, watch } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-581',
})

interface Issue581Row {
  name: string
}

function fetchIssue581Rows(): Issue581Row[] {
  return [{ name: '123' }, { name: '456' }]
}

function useIssue581List() {
  const queryData = ref<Issue581Row[]>()
  const state = reactive([{ name: 'init' }])
  const loading = ref(true)

  watch(queryData, (newData) => {
    state.push(...newData || [])
  })

  Promise.resolve().then(() => {
    loading.value = false
    queryData.value = fetchIssue581Rows()
  })

  return {
    state,
    loading,
  }
}

const back = useIssue581List()

function _runE2E() {
  return {
    ok: true,
    issue: 581,
    loading: back.loading.value,
    rows: back.state.map(row => row.name),
  }
}
</script>

<template>
  <view class="issue581-page">
    <view class="issue581-title">
      issue-581 reactive array flush
    </view>
    <view class="issue581-loading" :data-loading="back.loading ? 'true' : 'false'">
      {{ back.loading ? 'loading' : 'loaded' }}
    </view>
    <view
      v-for="(value, idx) in back.state"
      :key="idx"
      class="issue581-row"
      :data-issue581-name="value.name"
      :data-issue581-index="idx"
    >
      {{ value.name }}
    </view>
  </view>
</template>

<style scoped>
.issue581-page {
  min-height: 100vh;
  padding: 32rpx;
  background: #f8fafc;
}

.issue581-title {
  margin-bottom: 24rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue581-loading {
  margin-bottom: 16rpx;
  color: #475569;
}

.issue581-row {
  display: block;
  min-height: 32rpx;
  color: #111827;
}
</style>
