<script lang="ts">
import { ref } from 'wevu'

export default {
  name: 'LibSfcBothLegacy',
  options: {
    virtualHost: true,
  },
}
</script>

<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
  options: {
    multipleSlots: true,
  },
})

const props = withDefaults(defineProps<{
  title?: string
  variant?: 'plain' | 'soft' | 'outline'
  tone?: 'forest' | 'mint' | 'teal'
}>(), {
  title: 'SFC (script + setup)',
  variant: 'soft',
  tone: 'forest',
})

const emit = defineEmits<{
  (e: 'change', value: boolean): void
  (e: 'press', payload: { count: number }): void
}>()
const checked = defineModel<boolean>('checked', { default: false })
const count = ref(0)

function toggleChecked() {
  checked.value = !checked.value
  emit('change', checked.value)
}

function bumpCount() {
  count.value += 1
  emit('press', { count: count.value })
}

function reset() {
  checked.value = false
  count.value = 0
}

defineExpose({
  toggleChecked,
  bumpCount,
  reset,
})
</script>

<template>
  <view
    class="card"
    :class="[
      `variant-${props.variant}`,
      `tone-${props.tone}`,
      { 'is-checked': checked, 'has-count': count > 0 },
    ]"
  >
    <view class="title">
      {{ props.title }}
    </view>
    <view class="desc">
      Checked: {{ checked ? 'yes' : 'no' }} · Count: {{ count }}
    </view>
    <view class="actions">
      <button class="btn ghost" @tap="toggleChecked">
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
  background: #f0fdf4;
  border: 2rpx solid transparent;
  border-radius: 16rpx;
}

.title {
  font-size: 28rpx;
  font-weight: 600;
  color: #0f3d2e;
}

.desc {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #165445;
}

.actions {
  display: flex;
  gap: 12rpx;
  margin-top: 16rpx;
}

.btn {
  padding: 8rpx 16rpx;
  font-size: 22rpx;
  color: #f0fdf4;
  background: #0f3d2e;
  border: 2rpx solid #0f3d2e;
  border-radius: 999rpx;
}

.btn.ghost {
  color: #0f3d2e;
  background: transparent;
}

.tone-forest {
  background: #f0fdf4;
  border-color: #86efac;
}

.tone-mint {
  background: #ecfeff;
  border-color: #67e8f9;
}

.tone-teal {
  background: #f0fdfa;
  border-color: #5eead4;
}

.variant-plain {
  background: #fff;
}

.variant-soft {
  box-shadow: inset 0 0 0 1rpx rgb(15 61 46 / 12%);
}

.variant-outline {
  background: transparent;
}

.is-checked {
  box-shadow: 0 0 0 4rpx rgb(16 185 129 / 20%);
}

.has-count .title {
  letter-spacing: 1rpx;
}
</style>
