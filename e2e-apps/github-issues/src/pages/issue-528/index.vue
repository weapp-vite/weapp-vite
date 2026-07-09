<script setup lang="ts">
import Issue528SlotFallbackCard from '../../components/issue-528/SlotFallbackCard/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-528',
})

function _runE2E() {
  return {
    fallbackHeader: 'issue-528 fallback header',
    fallbackDefault: 'issue-528 fallback default',
    providedHeader: 'issue-528 provided header',
    providedDefault: 'issue-528 provided default',
  }
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <view class="issue528-page">
    <Issue528SlotFallbackCard class="issue528-card-empty" />
    <Issue528SlotFallbackCard class="issue528-card-provided">
      <template #header>
        <text class="issue528-provided-header">issue-528 provided header</text>
      </template>
      <text class="issue528-provided-default">issue-528 provided default</text>
    </Issue528SlotFallbackCard>
  </view>
</template>

<style>
.issue528-page {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding: 24rpx;
}
</style>
