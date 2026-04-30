<script setup lang="ts">
import { computed } from 'wevu'

const props = defineProps<{
  label: string
  value: string | number
  tone?: 'stable' | 'watch' | 'risk'
}>()

const toneText = computed(() => {
  if (props.tone === 'risk') {
    return 'risk'
  }

  if (props.tone === 'watch') {
    return 'watch'
  }

  return 'stable'
})
</script>

<template>
  <view class="vue-runtime-card" :class="`vue-runtime-card--${toneText}`">
    <text class="vue-runtime-card__label">
      {{ label }}
    </text>
    <text class="vue-runtime-card__value">
      {{ value }}
    </text>
  </view>
</template>

<style scoped>
.vue-runtime-card {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  min-width: 0;
  padding: 24rpx;
  background: #fff;
  border: 1rpx solid #d8e2ec;
  border-radius: 18rpx;
}

.vue-runtime-card--stable {
  border-color: #99f6e4;
}

.vue-runtime-card--watch {
  border-color: #fde68a;
}

.vue-runtime-card--risk {
  border-color: #fecdd3;
}

.vue-runtime-card__label {
  font-size: 22rpx;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 1.5rpx;
}

.vue-runtime-card__value {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 36rpx;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
}
</style>
