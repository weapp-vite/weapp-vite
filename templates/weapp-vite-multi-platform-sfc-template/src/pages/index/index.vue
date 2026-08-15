<script setup lang="ts">
import { computed, ref } from 'wevu'
import PlatformCard from '../../components/PlatformCard/index.vue'

definePageJson({
  navigationBarTitleText: '多平台 SFC 模板',
})

const platform = import.meta.env.PLATFORM
const status = ref('ready')
const count = ref(0)
const doubled = computed(() => count.value * 2)

function increment() {
  count.value += 1
}
</script>

<template>
  <view class="page-shell">
    <view class="page-heading">
      <view class="page-heading__eyebrow">
        weapp-vite + wevu
      </view>
      <view class="page-heading__title">
        Vue SFC 多平台 + Web
      </view>
      <view class="page-heading__description">
        同一份 SFC 源码，按目标平台独立构建和验收。
      </view>
    </view>

    <view id="platform-marker" class="runtime-marker">
      MP_PLATFORM={{ platform }}
    </view>
    <view id="runtime-status" class="runtime-status">
      status={{ status }}
    </view>

    <PlatformCard :platform="platform" />

    <view class="counter-panel">
      <view class="counter-panel__label">
        SFC 响应式交互检查
      </view>
      <view id="counter-value" class="counter-panel__value">
        {{ count }}
      </view>
      <view id="counter-doubled" class="counter-panel__doubled">
        doubled={{ doubled }}
      </view>
      <button id="increment-button" class="counter-panel__button" @tap="increment">
        增加计数
      </button>
    </view>
  </view>
</template>

<style>
.page-shell {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 72rpx 32rpx 48rpx;
}

.page-heading {
  margin-bottom: 32rpx;
}

.page-heading__eyebrow {
  font-size: 24rpx;
  font-weight: 600;
  color: #1a7f37;
}

.page-heading__title {
  margin-top: 12rpx;
  font-size: 52rpx;
  font-weight: 700;
  color: #17212b;
}

.page-heading__description {
  margin-top: 16rpx;
  font-size: 28rpx;
  line-height: 1.6;
  color: #57606a;
}

.runtime-marker,
.runtime-status {
  font-family: monospace;
  font-size: 24rpx;
  color: #57606a;
}

.runtime-status {
  margin: 8rpx 0 28rpx;
}

.counter-panel {
  padding: 32rpx;
  margin-top: 24rpx;
  text-align: center;
  background: #fff;
  border: 2rpx solid #d8dee4;
  border-radius: 12rpx;
}

.counter-panel__label,
.counter-panel__doubled {
  font-size: 26rpx;
  color: #57606a;
}

.counter-panel__value {
  margin: 18rpx 0 8rpx;
  font-size: 64rpx;
  font-weight: 700;
  color: #17212b;
}

.counter-panel__button {
  width: 100%;
  margin-top: 24rpx;
  color: #fff;
  background: #1f883d;
  border-radius: 8rpx;
}

.counter-panel__button::after {
  border: 0;
}
</style>
