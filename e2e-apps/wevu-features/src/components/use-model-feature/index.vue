<script setup lang="ts">
import { useModel } from 'vue'

const props = defineProps<{
  modelValue: string
  title: string
}>()

const model = useModel<string>(props, 'modelValue')

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
  margin-top: 20rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  border: 2rpx solid #cbd5e1;
  background: #fff;
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
  margin-top: 12rpx;
  display: flex;
  flex-wrap: wrap;
}

.use-model-feature__btn {
  margin: 6rpx;
  min-height: 56rpx;
  line-height: 56rpx;
  padding: 0 16rpx;
  border-radius: 9999rpx;
  background: #e2e8f0;
  color: #1f2937;
  font-size: 22rpx;
}
</style>
