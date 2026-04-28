<template>
  <view class="issue520-card">
    <view class="issue520-card__header">
      <slot name="header" />
    </view>
    <view class="issue520-card__body">
      <slot />
    </view>
  </view>
</template>

<style>
.issue520-card {
  padding: 16rpx;
}

.issue520-card__header {
  font-weight: 600;
}

.issue520-card__body {
  margin-top: 8rpx;
}
</style>
