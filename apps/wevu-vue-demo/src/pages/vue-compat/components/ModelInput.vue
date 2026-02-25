<script setup lang="ts">
import { computed } from 'wevu'

const props = withDefaults(
  defineProps<{
    label?: string
  }>(),
  {
    label: 'Model Input',
  },
)

const [modelValue, modelModifiers] = defineModel<string, 'trim' | 'uppercase'>()

const normalizedValue = computed({
  get: () => modelValue.value || '',
  set: (value: string) => {
    let next = value
    if (modelModifiers.trim) {
      next = next.trim()
    }
    if (modelModifiers.uppercase) {
      next = next.toUpperCase()
    }
    modelValue.value = next
  },
})
</script>

<template>
  <view class="field">
    <text class="field-label">
      {{ props.label }}
    </text>
    <input
      v-model="normalizedValue"
      class="field-input"
      placeholder="输入内容会 trim + uppercase"
    >
    <text class="field-meta">
      modifiers: trim={{ !!modelModifiers.trim }}, uppercase={{ !!modelModifiers.uppercase }}
    </text>
  </view>
</template>

<style>
.field {
  margin-top: 10rpx;
}

.field-label {
  display: block;
  margin-bottom: 8rpx;
  font-size: 23rpx;
  color: #4d5d7d;
}

.field-input {
  height: 72rpx;
  padding: 0 14rpx;
  font-size: 24rpx;
  background: #f0f4ff;
  border-radius: 12rpx;
}

.field-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #5f6882;
}
</style>
