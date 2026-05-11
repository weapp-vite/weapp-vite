<script setup lang="ts">
import { useModel } from 'wevu'

const props = defineProps<{
  abc: string
  modelValue: string
}>()

const abcModel = useModel<string>(props, 'abc')
const defaultModel = useModel<string>(props, 'modelValue')

function updateAbc() {
  abcModel.value = 'abc-from-child'
}

function updateModelValue() {
  defaultModel.value = 'model-from-child'
}
</script>

<template>
  <view class="issue553-model-probe">
    <view class="issue553-model-probe__value issue553-child-abc">
      child abc = {{ abcModel }}
    </view>
    <view class="issue553-model-probe__value issue553-child-model">
      child model = {{ defaultModel }}
    </view>
    <view class="issue553-model-probe__actions">
      <view id="issue553-update-abc" class="issue553-model-probe__button issue553-update-abc" @tap="updateAbc">
        update abc
      </view>
      <view id="issue553-update-model" class="issue553-model-probe__button issue553-update-model" @tap="updateModelValue">
        update model
      </view>
    </view>
  </view>
</template>

<style scoped>
.issue553-model-probe {
  padding: 20rpx;
  margin-top: 20rpx;
  background: #fff;
  border: 2rpx solid #94a3b8;
  border-radius: 12rpx;
}

.issue553-model-probe__value {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #1f2937;
}

.issue553-model-probe__actions {
  display: flex;
  flex-wrap: wrap;
  margin-top: 14rpx;
}

.issue553-model-probe__button {
  min-height: 56rpx;
  padding: 0 18rpx;
  margin: 6rpx;
  font-size: 22rpx;
  line-height: 56rpx;
  color: #0f172a;
  background: #dbeafe;
  border-radius: 8rpx;
}
</style>
