<script setup lang="ts">
import { useAttrs, useSlots } from 'vue'

const slots = defineSlots<{
  default?: () => any
}>()
const model = defineModel<string>()
const attrs = useAttrs()
const runtimeSlots = useSlots()

function onInput(event: any) {
  model.value = event?.detail?.value ?? ''
}

defineExpose({
  model,
  attrs,
  slots,
  runtimeSlots,
})
</script>

<template>
  <view class="wrap">
    <text class="label">
      child modelValue: {{ model }}
    </text>
    <input class="input" :value="model" @input="onInput($event)">
    <text class="muted">
      attrs keys: {{ Object.keys(attrs).join(', ') || 'none' }}
    </text>
    <text class="muted">
      slots keys: {{ Object.keys(runtimeSlots).join(', ') || 'none' }}
    </text>
    <slot />
  </view>
</template>

<style scoped>
/* stylelint-disable order/properties-order */
.wrap {
  padding: 16rpx;
  border-radius: 16rpx;
  background: #ffffff;
  border: 1rpx solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.label {
  font-size: 26rpx;
  color: #0f172a;
}

.input {
  height: 80rpx;
  line-height: 80rpx;
  padding: 0 20rpx;
  border-radius: 12rpx;
  border: 1rpx solid #cbd5e1;
}

.muted {
  font-size: 22rpx;
  color: #64748b;
}
/* stylelint-enable order/properties-order */
</style>
