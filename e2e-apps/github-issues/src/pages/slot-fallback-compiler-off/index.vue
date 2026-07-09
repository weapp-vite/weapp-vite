<script setup lang="ts">
import PlainSlotFallbackCard from '../../components/slot-fallback-compiler-off/PlainSlotFallbackCard/index.vue'

definePageJson({
  navigationBarTitleText: 'slot-fallback-compiler-off',
})

function _runE2E() {
  return {
    fallbackHeader: 'slot-fallback-compiler-off fallback header',
    fallbackDefault: 'slot-fallback-compiler-off fallback default',
    providedHeader: 'slot-fallback-compiler-off provided header',
    providedDefault: 'slot-fallback-compiler-off provided default',
  }
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <view
    id="slot-fallback-compiler-off-page"
    class="slot-fallback-off-page"
    data-e2e-route="slot-fallback-compiler-off"
  >
    <PlainSlotFallbackCard class="slot-fallback-off-card-empty" />
    <PlainSlotFallbackCard class="slot-fallback-off-card-provided">
      <template #header>
        <text
          class="slot-fallback-off-provided-header"
          data-slot-fallback-off-case="provided-header"
        >
          slot-fallback-compiler-off provided header
        </text>
      </template>
      <text
        class="slot-fallback-off-provided-default"
        data-slot-fallback-off-case="provided-default"
      >
        slot-fallback-compiler-off provided default
      </text>
    </PlainSlotFallbackCard>
  </view>
</template>

<style>
.slot-fallback-off-page {
  padding: 16px;
}
</style>
