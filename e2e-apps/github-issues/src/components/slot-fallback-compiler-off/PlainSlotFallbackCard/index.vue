<script setup lang="ts">
const fallbackDefault = 'slot-fallback-compiler-off fallback default'
</script>

<template>
  <view class="slot-fallback-off-card">
    <view class="slot-fallback-off-card__header">
      <slot name="header">
        <text
          class="slot-fallback-off-fallback-header"
          data-slot-fallback-off-case="fallback-header"
        >
          slot-fallback-compiler-off fallback header
        </text>
      </slot>
    </view>
    <view class="slot-fallback-off-card__body">
      <slot>
        <text
          class="slot-fallback-off-fallback-default"
          data-slot-fallback-off-case="fallback-default"
        >
          {{ fallbackDefault }}
        </text>
      </slot>
    </view>
  </view>
</template>

<style>
.slot-fallback-off-card {
  display: block;
}

.slot-fallback-off-card__header {
  min-height: 24px;
}

.slot-fallback-off-card__body {
  min-height: 24px;
}
</style>
