<script setup lang="ts">
import Issue530SlotFallbackProbe from '../../components/issue-530/SlotFallbackProbe/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-530',
})
</script>

<template>
  <view class="issue530-page">
    <Issue530SlotFallbackProbe class="issue530-card-empty" />
    <Issue530SlotFallbackProbe class="issue530-card-provided">
      <text class="issue530-provided-default">issue-530 provided default</text>
    </Issue530SlotFallbackProbe>
  </view>
</template>

<style>
.issue530-page {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding: 24rpx;
}
</style>
