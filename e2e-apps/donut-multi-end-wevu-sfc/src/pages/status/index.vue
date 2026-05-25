<script setup lang="ts">
import { computed, ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'Wevu 多端状态',
})

const enabled = ref(true)
const capabilityRows = computed(() => [
  { label: 'Donut project', value: 'multiPlatform' },
  { label: 'Authoring', value: 'Vue SFC' },
  { label: 'Runtime', value: 'wevu' },
  { label: 'Status', value: enabled.value ? 'enabled' : 'disabled' },
])

function toggleEnabled() {
  enabled.value = !enabled.value
}
</script>

<template>
  <view class="page">
    <view class="title">
      Capability Status
    </view>
    <view
      v-for="row in capabilityRows"
      :key="row.label"
      class="row"
    >
      <text class="row__label">
        {{ row.label }}
      </text>
      <text class="row__value">
        {{ row.value }}
      </text>
    </view>
    <button class="action" @tap="toggleEnabled">
      Toggle status
    </button>
  </view>
</template>

<style>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 32rpx;
}

.title {
  margin-bottom: 22rpx;
  font-size: 36rpx;
  font-weight: 700;
  color: #0f172a;
}

.row {
  display: flex;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 2rpx solid #e2e8f0;
}

.row__label {
  color: #64748b;
}

.row__value {
  font-weight: 700;
  color: #0f172a;
}

.action {
  margin-top: 28rpx;
  color: #fff;
  background: #0f766e;
  border-radius: 999rpx;
}
</style>
