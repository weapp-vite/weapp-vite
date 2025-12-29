<script setup lang="ts">
import { computed, ref } from 'wevu'

const badgeTypes = ['info', 'success', 'warning'] as const
const currentIndex = ref(0)
const currentType = computed(() => badgeTypes[currentIndex.value])

function handleSwitch() {
  currentIndex.value = (currentIndex.value + 1) % badgeTypes.length
}
</script>

<template>
  <view class="vue-native-card">
    <view class="vue-native-card__header">
      <text class="vue-native-card__title">
        Vue 组件内部使用原生组件
      </text>
      <text class="vue-native-card__desc">
        native-badge 来自原生自定义组件
      </text>
    </view>
    <view class="vue-native-card__body">
      <native-badge :text="`状态：${currentType}`" :type="currentType" />
      <button class="btn btn-info vue-native-card__btn" size="mini" @click="handleSwitch">
        切换徽标风格
      </button>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.vue-native-card {
  background: #f8f9ff;
  border-radius: 12rpx;
  padding: 24rpx;
  border: 1rpx solid #e5e7eb;
}

.vue-native-card__header {
  margin-bottom: 16rpx;
}

.vue-native-card__title {
  font-size: 30rpx;
  font-weight: 600;
  color: #111827;
}

.vue-native-card__desc {
  display: block;
  margin-top: 4rpx;
  font-size: 24rpx;
  color: #6b7280;
}

.vue-native-card__body {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.vue-native-card__btn {
  padding: 12rpx 20rpx;
  border-radius: 10rpx;
  font-size: 24rpx;
}
/* stylelint-enable order/properties-order */
</style>

<config lang="json">
{
  "$schema": "https://vite.icebreaker.top/component.json",
  "component": true,
  "styleIsolation": "apply-shared",
  "usingComponents": {
    "native-badge": "/native/native-badge/index"
  }
}
</config>
