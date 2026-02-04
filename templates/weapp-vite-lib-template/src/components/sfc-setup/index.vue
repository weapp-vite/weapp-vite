<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'LibSfcSetup',
  inheritAttrs: false,
  options: {
    multipleSlots: true,
  },
})

const props = withDefaults(defineProps<{
  title?: string
  tone?: 'info' | 'success' | 'warning'
  size?: 'sm' | 'md' | 'lg'
}>(), {
  title: 'SFC (script setup)',
  tone: 'info',
  size: 'md',
})

const emit = defineEmits<{
  (e: 'toggle', value: boolean): void
  (e: 'bump', payload: { count: number }): void
}>()
const active = defineModel<boolean>('active', { default: false })
const count = ref(0)

function toggleActive() {
  active.value = !active.value
  emit('toggle', active.value)
}

function bumpCount() {
  count.value += 1
  emit('bump', { count: count.value })
}

function reset() {
  active.value = false
  count.value = 0
}

defineExpose({
  toggleActive,
  bumpCount,
  reset,
})
</script>

<template>
  <view
    class="card"
    :class="[
      `tone-${props.tone}`,
      `size-${props.size}`,
      { 'is-active': active, 'has-count': count > 0 },
    ]"
  >
    <view class="title">
      {{ props.title }}
    </view>
    <view class="desc">
      State: {{ active ? 'active' : 'idle' }} · Count: {{ count }}
    </view>
    <view class="actions">
      <button class="btn ghost" @tap="toggleActive">
        Toggle
      </button>
      <button class="btn" @tap="bumpCount">
        +1
      </button>
    </view>
  </view>
</template>

<style>
.card {
  padding: 20rpx;
  border-radius: 16rpx;
  border: 2rpx solid transparent;
  background: #eff6ff;
}

.title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1d4ed8;
}

.desc {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #1e40af;
}

.actions {
  display: flex;
  gap: 12rpx;
  margin-top: 16rpx;
}

.btn {
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  border: 2rpx solid #1d4ed8;
  background: #1d4ed8;
  color: #eff6ff;
  font-size: 22rpx;
}

.btn.ghost {
  background: transparent;
  color: #1d4ed8;
}

.tone-info {
  background: #eff6ff;
  border-color: #93c5fd;
}

.tone-success {
  background: #ecfdf3;
  border-color: #86efac;
}

.tone-warning {
  background: #fff7ed;
  border-color: #fdba74;
}

.size-sm {
  padding: 16rpx;
}

.size-md {
  padding: 20rpx;
}

.size-lg {
  padding: 24rpx;
}

.is-active {
  box-shadow: 0 0 0 4rpx rgba(29, 78, 216, 0.2);
}

.has-count .title {
  letter-spacing: 1rpx;
}
</style>
