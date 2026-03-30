<script setup lang="ts">
import { storeToRefs } from 'wevu/store'
import { useIssue373Store } from '../../../shared/issue373Store'

definePageJson({
  navigationBarTitleText: 'issue-373-result',
  backgroundColor: '#ffffff',
})

const store = useIssue373Store()
const { count, doubled } = storeToRefs(store)

function increment() {
  store.increment()
}

function _runE2E() {
  return {
    ok: doubled.value === count.value * 2,
    count: count.value,
    doubled: doubled.value,
  }
}
</script>

<template>
  <view class="issue373-result-page">
    <text class="issue373-result-title">
      issue-373 reLaunch store computed result
    </text>
    <text class="issue373-result-count">
      result count: {{ count }}
    </text>
    <text class="issue373-result-double">
      result doubled: {{ doubled }}
    </text>
    <view
      class="issue373-result-probe"
      :data-count="count"
      :data-doubled="doubled"
    >
      result probe
    </view>
    <button
      class="issue373-result-btn"
      @tap="increment"
    >
      increment count
    </button>
  </view>
</template>

<style scoped>
.issue373-result-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #eff6ff;
}

.issue373-result-title,
.issue373-result-count,
.issue373-result-double,
.issue373-result-probe {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #0f172a;
}

.issue373-result-title {
  margin-top: 0;
  font-size: 30rpx;
  font-weight: 700;
}

.issue373-result-btn {
  margin-top: 20rpx;
}
</style>
