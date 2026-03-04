<script setup lang="ts">
const emit = defineEmits<{
  (event: 'overlay-click'): void
}>()

function emitOverlayClick() {
  emit('overlay-click')
}
</script>

<template>
  <view class="issue316-emitter">
    <button
      class="issue316-emitter-btn"
      @tap="emitOverlayClick"
    >
      emit overlay-click
    </button>
  </view>
</template>

<style scoped>
.issue316-emitter {
  margin-top: 16rpx;
}

.issue316-emitter-btn {
  min-height: 60rpx;
  padding: 0 24rpx;
  font-size: 24rpx;
  color: #1d4ed8;
  background: #dbeafe;
  border-radius: 10rpx;
}
</style>
