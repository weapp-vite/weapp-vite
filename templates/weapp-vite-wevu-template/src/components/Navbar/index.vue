<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
  }>(),
  {
    title: 'WeVU Template',
    subtitle: '',
  },
)
</script>

<template>
  <view class="navbar">
    <view class="navbar-content">
      <text class="navbar-title">
        {{ props.title }}
      </text>
      <text v-if="props.subtitle" class="navbar-subtitle">
        {{ props.subtitle }}
      </text>
    </view>

    <view class="navbar-right">
      <slot name="right" />
    </view>
  </view>
</template>

<style>
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(env(safe-area-inset-top) + 20rpx) 28rpx 20rpx;
  margin-bottom: 24rpx;
  background: linear-gradient(135deg, #4c6ef5, #7048e8);
  border-radius: 24rpx;
}

.navbar-content {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.navbar-title {
  font-size: 38rpx;
  font-weight: 700;
  color: #fff;
}

.navbar-subtitle {
  font-size: 24rpx;
  color: rgb(255 255 255 / 82%);
}

.navbar-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 120rpx;
}
</style>
