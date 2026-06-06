<script setup lang="ts">
const props = defineProps<{
  root: {
    a: string
  }
}>()

function _runE2E() {
  const root = props.root
  return {
    type: root === null ? 'null' : Array.isArray(root) ? 'array' : typeof root,
    isObject: root !== null && typeof root === 'object' && !Array.isArray(root),
    a: root?.a ?? '',
  }
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <view id="info-banner" class="info-banner">
    {{ root.a }}
  </view>
</template>

<style scoped>
.info-banner {
  padding: 20rpx 24rpx;
  font-size: 26rpx;
  font-weight: 500;
  color: #1e293b;
  background: #e2e8f0;
  border-radius: 12rpx;
}
</style>
