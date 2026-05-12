<script setup lang="ts">
import PlainSlotFallbackCard from '../../components/slot-fallback-compiler-off/PlainSlotFallbackCard/index.vue'

definePageJson({
  navigationBarTitleText: 'slot-fallback-compiler-off',
})
</script>

<template>
  <view class="slot-fallback-off-page">
    <PlainSlotFallbackCard class="slot-fallback-off-card-empty" />
    <PlainSlotFallbackCard class="slot-fallback-off-card-provided">
      <template #header>
        <text class="slot-fallback-off-provided-header">slot-fallback-compiler-off provided header</text>
      </template>
      <text class="slot-fallback-off-provided-default">slot-fallback-compiler-off provided default</text>
    </PlainSlotFallbackCard>
  </view>
</template>

<style>
.slot-fallback-off-page {
  padding: 16px;
}
</style>
