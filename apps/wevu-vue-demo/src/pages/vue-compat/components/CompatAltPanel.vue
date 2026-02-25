<script setup lang="ts">
interface RunPayload {
  at: string
  title: string
}

const props = defineProps<{
  title: string
}>()

const emit = defineEmits<{
  run: [RunPayload]
}>()

function run() {
  emit('run', {
    at: new Date().toISOString(),
    title: props.title,
  })
}
</script>

<template>
  <view class="alt-panel">
    <text class="alt-title">
      {{ props.title }}
    </text>
    <text class="alt-desc">
      这个组件用于测试动态组件切换（component :is）。
    </text>
    <button class="alt-btn" @tap="run">
      emit run（alt）
    </button>
  </view>
</template>

<style>
.alt-panel {
  padding: 16rpx;
  margin-bottom: 14rpx;
  background: #fff5e8;
  border-radius: 14rpx;
}

.alt-title {
  display: block;
  font-size: 27rpx;
  font-weight: 600;
  color: #774500;
}

.alt-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 23rpx;
  color: #88570f;
}

.alt-btn {
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 66rpx;
  color: #fff;
  background: #a05a00;
  border-radius: 12rpx;
}
</style>
