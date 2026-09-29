<script setup lang="ts">
defineOptions({ options: { virtualHost: true, multipleSlots: true } })
defineProps<{ value: number }>()
</script>

<template>
  <view class="slot-probe">
    <slot name="header" />
    <slot :value="value" />
  </view>
</template>
