<script setup lang="ts">
import { storeToRefs } from 'wevu/store'
import { useIssue373Store } from '../../../shared/issue373Store'

definePageJson({
  navigationBarTitleText: 'issue-373-launch',
  backgroundColor: '#ffffff',
})

const store = useIssue373Store()
const { count, doubled } = storeToRefs(store)

function runRelaunch() {
  store.reset()
  void wx.reLaunch({
    url: '/pages/issue-373/result/index',
  })
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
  <view class="issue373-launch-page">
    <text class="issue373-launch-title">
      issue-373 store computed survives reLaunch
    </text>
    <text class="issue373-launch-count">
      launch count: {{ count }}
    </text>
    <text class="issue373-launch-double">
      launch doubled: {{ doubled }}
    </text>
    <view
      class="issue373-launch-probe"
      :data-count="count"
      :data-doubled="doubled"
    >
      launch probe
    </view>
    <button
      class="issue373-launch-btn"
      @tap="runRelaunch"
    >
      run reLaunch
    </button>
  </view>
</template>

<style scoped>
.issue373-launch-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #f8fafc;
}

.issue373-launch-title,
.issue373-launch-count,
.issue373-launch-double,
.issue373-launch-probe {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #0f172a;
}

.issue373-launch-title {
  margin-top: 0;
  font-size: 30rpx;
  font-weight: 700;
}

.issue373-launch-btn {
  margin-top: 20rpx;
}
</style>
