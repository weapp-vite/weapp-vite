<script setup lang="ts">
interface Props {
  title: string
  description: string
}

defineProps<Props>()
const emit = defineEmits<{
  change: [value: string]
}>()

function emitChange() {
  emit('change', 'info-card-change')
}
</script>

<template>
  <view id="tsx-info-card" class="card-wrap">
    <text class="card-title">
      {{ title }}
    </text>
    <text class="card-desc">
      {{ description }}
    </text>
    <button id="tsx-info-card-action" size="mini" @tap="emitChange">
      emit
    </button>
  </view>
</template>

<style>
.card-wrap {
  padding: 20rpx;
  margin-bottom: 16rpx;
  background: #f0f9ff;
  border: 2rpx dashed #38bdf8;
  border-radius: 16rpx;
}

.card-title {
  display: block;
  margin-bottom: 8rpx;
  font-size: 30rpx;
  font-weight: 600;
}

.card-desc {
  color: #0369a1;
}
</style>
