<script setup lang="ts">
import { ref, useNativeInstance } from 'wevu'
import ModelArgumentProbe from '../../components/issue-553/ModelArgumentProbe/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-553',
})

const abc = ref('abc-seed')
const modelValue = ref('model-seed')
const nativeInstance = useNativeInstance()

function triggerChildMethod(methodName: 'updateAbc' | 'updateModelValue') {
  const component = (nativeInstance as any).selectComponent?.('#issue553-probe') as Record<string, any> | undefined
  const method = component?.[methodName]
  if (typeof method !== 'function') {
    return false
  }
  method.call(component)
  return true
}

function triggerChildAbcE2E() {
  return triggerChildMethod('updateAbc')
}

function triggerChildModelE2E() {
  return triggerChildMethod('updateModelValue')
}

function _runE2E() {
  return {
    abc: abc.value,
    modelValue: modelValue.value,
  }
}

defineExpose({
  triggerChildAbcE2E,
  triggerChildModelE2E,
  _runE2E,
})
</script>

<template>
  <view class="issue553-page">
    <view class="issue553-title">
      issue-553 v-model argument
    </view>
    <view class="issue553-parent-abc">
      parent abc = {{ abc }}
    </view>
    <view class="issue553-parent-model">
      parent model = {{ modelValue }}
    </view>

    <ModelArgumentProbe
      id="issue553-probe"
      v-model:abc="abc"
      v-model="modelValue"
    />
  </view>
</template>

<style scoped>
.issue553-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 32rpx;
  background: #f8fafc;
}

.issue553-title {
  margin-bottom: 20rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue553-parent-abc,
.issue553-parent-model {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #334155;
}
</style>
