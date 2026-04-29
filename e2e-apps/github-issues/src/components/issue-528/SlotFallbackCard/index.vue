<script setup lang="ts">
const fallbackDefault = 'issue-528 fallback default'
</script>

<template>
  <view class="issue528-card">
    <view class="issue528-card__header">
      <slot name="header">
        <text class="issue528-fallback-header">issue-528 fallback header</text>
      </slot>
    </view>
    <view class="issue528-card__body">
      <slot>
        <text class="issue528-fallback-default">{{ fallbackDefault }}</text>
      </slot>
    </view>
  </view>
</template>

<style>
.issue528-card {
  padding: 16rpx;
}

.issue528-card__header {
  font-weight: 600;
}

.issue528-card__body {
  margin-top: 8rpx;
}
</style>
