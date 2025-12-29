<script setup lang="ts">
type ChangeEvent = WechatMiniprogram.Input

const props = withDefaults(defineProps<{
  modelValue: string
  title?: string
  numberValue?: number
  placeholder?: string
}>(), {
  title: '',
  numberValue: 0,
  placeholder: '输入内容',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:title', value: string): void
  (e: 'update:numberValue', value: number): void
  (e: 'change', value: string): void
}>()

function onModelInput(event: ChangeEvent) {
  const value = event.detail.value
  emit('update:modelValue', value)
  emit('change', value)
}

function onTitleInput(event: ChangeEvent) {
  emit('update:title', event.detail.value)
}

function onNumberInput(event: ChangeEvent) {
  const next = Number(event.detail.value)
  emit('update:numberValue', Number.isNaN(next) ? 0 : next)
}
</script>

<template>
  <view class="panel">
    <view class="row">
      <text class="label">
        v-model
      </text>
      <input
        class="input"
        :value="props.modelValue"
        :placeholder="props.placeholder"
        @input="onModelInput"
      >
    </view>

    <view class="row">
      <text class="label">
        v-model:title
      </text>
      <input
        class="input"
        :value="props.title"
        placeholder="修改 title"
        @input="onTitleInput"
      >
    </view>

    <view class="row">
      <text class="label">
        v-model.number
      </text>
      <input
        class="input"
        type="number"
        :value="String(props.numberValue)"
        placeholder="输入数字"
        @input="onNumberInput"
      >
    </view>
  </view>
</template>

<style scoped>
/* stylelint-disable order/properties-order */
.panel {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 16rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.row {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.label {
  font-size: 24rpx;
  color: #475569;
}

.input {
  padding: 16rpx;
  background: #ffffff;
  border-radius: 12rpx;
  border: 1rpx solid #e2e8f0;
  font-size: 26rpx;
  color: #0f172a;
}
/* stylelint-enable order/properties-order */
</style>
