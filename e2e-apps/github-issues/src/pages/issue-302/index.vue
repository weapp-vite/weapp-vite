<script setup lang="ts">
import { ref } from 'wevu'

const active = ref('a')

const tabs = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
]

function setActive(id: string) {
  active.value = id
}

function _runE2E() {
  return {
    active: active.value,
    ok: ['a', 'b', 'c'].includes(active.value),
  }
}
</script>

<template>
  <view class="issue302-page">
    <text class="issue302-title">
      issue-302 v-for class binding update
    </text>
    <text class="issue302-active">
      active: {{ active }}
    </text>
    <view
      v-for="tab in tabs"
      :key="tab.id"
      class="issue302-item"
      :class="[
        `issue302-item-${tab.id}`,
        active === tab.id ? 'issue302-item-active' : 'issue302-item-inactive',
      ]"
      :data-id="tab.id"
      @tap="setActive(tab.id)"
    >
      <text class="issue302-label">
        {{ tab.label }}
      </text>
    </view>
  </view>
</template>

<style scoped>
.issue302-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
}

.issue302-title {
  display: block;
  margin-bottom: 10rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue302-active {
  display: block;
  margin-bottom: 12rpx;
  font-size: 24rpx;
  color: #334155;
}

.issue302-item {
  padding: 16rpx 18rpx;
  margin-bottom: 10rpx;
  border-radius: 10rpx;
}

.issue302-item-active {
  color: #fff;
  background: #2563eb;
}

.issue302-item-inactive {
  color: #0f172a;
  background: #cbd5e1;
}

.issue302-label {
  display: block;
  font-size: 24rpx;
}
</style>
