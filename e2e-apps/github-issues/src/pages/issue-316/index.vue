<script setup lang="ts">
import { ref } from 'wevu'
import HyphenEventEmitter from '../../components/issue-316/HyphenEventEmitter/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-316',
  backgroundColor: '#ffffff',
})

const overlayClickCount = ref(0)

function handleOverlayClick() {
  overlayClickCount.value += 1
}

function _runE2E() {
  return {
    ok: overlayClickCount.value >= 0,
    overlayClickCount: overlayClickCount.value,
  }
}
</script>

<template>
  <view class="issue316-page">
    <text class="issue316-title">
      issue-316 hyphen event binding
    </text>
    <text class="issue316-desc">
      custom component event: overlay-click
    </text>

    <HyphenEventEmitter
      class="issue316-emitter-host"
      @overlay-click="handleOverlayClick"
    />

    <view
      class="issue316-probe"
      :data-overlay-count="overlayClickCount"
    >
      overlay clicks: {{ overlayClickCount }}
    </view>
  </view>
</template>

<style scoped>
.issue316-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #fff;
}

.issue316-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue316-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #475569;
}

.issue316-probe {
  margin-top: 16rpx;
  font-size: 24rpx;
  color: #1e293b;
}
</style>
