<script setup lang="ts">
import { ref } from 'wevu'
import ValueProbe from '../../components/issue-328/ValueProbe/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-328',
  backgroundColor: '#ffffff',
})

const value1 = ref('111')

function advanceValue() {
  value1.value = value1.value === '111'
    ? '222'
    : '111'
}

function _runE2E() {
  return {
    ok: value1.value === '111' || value1.value === '222',
    value1: value1.value,
  }
}
</script>

<template>
  <view class="issue328-page">
    <text class="issue328-title">
      issue-328 setup ref prop first paint
    </text>
    <text class="issue328-desc">
      setup 中的 ref 首帧传给子组件 string prop 时，不应先落成 null 或默认值。
    </text>

    <view
      class="issue328-toggle"
      @tap="advanceValue"
    >
      toggle value: {{ value1 }}
    </view>

    <ValueProbe :value="value1" />
  </view>
</template>

<style scoped>
.issue328-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #eff6ff;
}

.issue328-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue328-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #475569;
}

.issue328-toggle {
  padding: 16rpx 20rpx;
  margin-top: 18rpx;
  font-size: 24rpx;
  font-weight: 600;
  color: #1d4ed8;
  background: #dbeafe;
  border-radius: 14rpx;
}
</style>
