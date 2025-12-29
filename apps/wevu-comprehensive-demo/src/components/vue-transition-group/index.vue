<script setup lang="ts">
const props = withDefaults(defineProps<{
  tag?: string
  name?: string
}>(), {
  tag: 'view',
  name: 'fade',
})

defineExpose({
  props,
})
</script>

<template>
  <view class="wrap" :data-name="props.name" :data-tag="props.tag">
    <slot />
  </view>
</template>

<style scoped>
/* stylelint-disable order/properties-order */
.wrap {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}
/* stylelint-enable order/properties-order */
</style>
