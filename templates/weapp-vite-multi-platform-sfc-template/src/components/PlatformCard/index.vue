<script setup lang="ts">
import { computed } from 'wevu'

const props = defineProps<{
  platform?: string
}>()

defineComponentJson({
  component: true,
})

const platformLabel = computed(() => props.platform || 'unknown')
</script>

<template>
  <view id="platform-card" class="platform-card">
    <view class="platform-card__label">
      当前 SFC 构建目标
    </view>
    <view id="component-platform" class="platform-card__value">
      {{ platformLabel }}
    </view>
    <view class="platform-card__hint">
      Page 与 Component 都由 Vue SFC 编译为目标平台产物
    </view>
  </view>
</template>

<style>
.platform-card {
  padding: 32rpx;
  background: #fff;
  border: 2rpx solid #d8dee4;
  border-radius: 12rpx;
}

.platform-card__label {
  font-size: 24rpx;
  color: #66717d;
}

.platform-card__value {
  margin-top: 10rpx;
  font-size: 44rpx;
  font-weight: 700;
  color: #0969da;
}

.platform-card__hint {
  margin-top: 18rpx;
  font-size: 26rpx;
  line-height: 1.6;
  color: #3d4852;
}
</style>
