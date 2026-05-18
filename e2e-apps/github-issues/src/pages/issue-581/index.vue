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

function createIssue581Rows(names: string[]): Issue581Row[] {
  return names.map(name => ({ name }))
}

function useIssue581List() {
  const queryData = ref<Issue581Row[]>()
  const state = reactive([{ name: 'init' }])
  const loading = ref(true)
  const flushCount = ref(0)

  watch(queryData, (newData) => {
    state.push(...newData || [])
  })

  Promise.resolve().then(() => {
    loading.value = false
    queryData.value = fetchIssue581Rows()
    flushCount.value += 1
  })

  return {
    state,
    loading,
    flushCount,
    appendRows(names: string[]) {
      loading.value = true
      queryData.value = createIssue581Rows(names)
      loading.value = false
      flushCount.value += 1
    },
  }
}

const back = useIssue581List()

function _runE2E() {
  return {
    ok: true,
    issue: 581,
    loading: back.loading.value,
    flushCount: back.flushCount.value,
    rows: back.state.map(row => row.name),
  }
}

function _appendIssue581Rows(names: string[]) {
  back.appendRows(names)
  return _runE2E()
}
</script>

<template>
  <view class="issue581-page">
    <view class="issue581-title">
      issue-581 reactive array flush
    </view>
    <view
      class="issue581-loading"
      :data-flush-count="back.flushCount"
      :data-loading="back.loading ? 'true' : 'false'"
      :data-row-count="back.state.length"
    >
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
