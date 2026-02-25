<script setup lang="ts">
interface RunPayload {
  at: string
  title: string
}

interface RunEventPayload {
  type?: string
  timeStamp?: number
  detail?: Record<string, any>
}

const props = defineProps<{
  title: string
}>()

const emit = defineEmits<{
  run: [RunPayload]
  runevent: [RunEventPayload]
}>()

function run() {
  const payload = {
    at: new Date().toISOString(),
    title: props.title,
  }
  // eslint-disable-next-line no-console
  console.log('[CompatAltPanel] emit run payload', payload)
  emit('run', payload)
}

function runWithEvent(event: RunEventPayload) {
  // eslint-disable-next-line no-console
  console.log('[CompatAltPanel] emit runevent payload', event)
  emit('runevent', event)
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
    <button class="alt-btn secondary" @tap="runWithEvent($event)">
      emit runevent（$event）
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

.alt-btn.secondary {
  background: #7a4a12;
}
</style>
