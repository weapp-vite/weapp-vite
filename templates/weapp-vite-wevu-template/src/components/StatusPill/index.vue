<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  tone?: 'neutral' | 'accent' | 'success'
}>(), {
  tone: 'neutral',
})
</script>

<template>
  <view class="badge" :class="`badge--${tone}`">
    {{ label }}
  </view>
</template>

<style>
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 120rpx;
  padding: 12rpx 22rpx;
  font-size: 22rpx;
  font-weight: 600;
  border-radius: 999rpx;
}

.badge--neutral {
  color: #475569;
  background: #e2e8f0;
}

.badge--accent {
  color: #155eef;
  background: #dbeafe;
}

.badge--success {
  color: #047857;
  background: #d1fae5;
}
</style>
