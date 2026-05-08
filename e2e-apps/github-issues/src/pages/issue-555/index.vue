<script setup lang="ts">
import { ref } from 'wevu'
import SlotCell from '../../components/issue-555/SlotCell/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-555',
})

const value = ref('issue-555 conditional slot text')

function toggleValue() {
  value.value = value.value ? '' : 'issue-555 conditional slot text'
}

function _runE2E() {
  return {
    value: value.value,
  }
}
</script>

<template>
  <view class="issue555-page">
    <view class="issue555-title">
      issue-555 slot v-if projection
    </view>

    <SlotCell>
      <template #text>
        <text
          v-if="value"
          class="issue555-text-probe"
          data-probe="conditional-text"
        >
          {{ value }}
        </text>
      </template>
    </SlotCell>

    <view class="issue555-action" @tap="toggleValue">
      toggle issue-555 value
    </view>
  </view>
</template>

<style scoped>
.issue555-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 32rpx;
  background: #f1f5f9;
}

.issue555-title {
  margin-bottom: 20rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue555-text-probe {
  color: #0369a1;
}

.issue555-action {
  padding: 20rpx;
  margin-top: 20rpx;
  color: #0f172a;
  background: #bae6fd;
  border-radius: 12rpx;
}
</style>
