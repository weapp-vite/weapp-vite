<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  tone?: 'info' | 'success'
}>(), {
  tone: 'info',
})
</script>

<template>
  <view class="badge" :class="`badge--${tone}`">
    {{ label }}
  </view>
</template>

<style>
.badge {
  padding: 16rpx 22rpx;
  margin-top: 18rpx;
  font-size: 22rpx;
  font-weight: 600;
  border-radius: 999rpx;
}

.badge--info {
  color: #1d4ed8;
  background: #dbeafe;
}

.badge--success {
  color: #0f766e;
  background: #ccfbf1;
}
</style>
