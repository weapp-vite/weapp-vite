<script setup lang="ts">
import { useModel } from 'vue'

const props = defineProps<{
  modelValue: string | null
  title: string
}>()

const model = useModel<string | null>(props, 'modelValue')

function applyValue(next: string) {
  model.value = next
}
</script>

<template>
  <view class="use-model-feature">
    <view class="use-model-feature__title">
      {{ props.title }}
    </view>

    <view id="model-inner-value" class="use-model-feature__value">
      inner model = {{ model }}
    </view>

    <view class="use-model-feature__actions">
      <view id="model-inner-alpha" class="use-model-feature__btn" @tap="applyValue('alpha-from-child')">
        child -> alpha
      </view>
      <view id="model-inner-beta" class="use-model-feature__btn" @tap="applyValue('beta-from-child')">
        child -> beta
      </view>
    </view>
  </view>
</template>

<style scoped>
.use-model-feature {
  padding: 20rpx;
  margin-top: 20rpx;
  background: #fff;
  border: 2rpx solid #cbd5e1;
  border-radius: 16rpx;
}

.use-model-feature__title {
  font-size: 28rpx;
  font-weight: 600;
  color: #0f172a;
}

.use-model-feature__value {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #334155;
}

.use-model-feature__actions {
  display: flex;
  flex-wrap: wrap;
  margin-top: 12rpx;
}

.use-model-feature__btn {
  min-height: 56rpx;
  padding: 0 16rpx;
  margin: 6rpx;
  font-size: 22rpx;
  line-height: 56rpx;
  color: #1f2937;
  background: #e2e8f0;
  border-radius: 9999rpx;
}
</style>
