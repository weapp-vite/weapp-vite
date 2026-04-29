<template>
  <view class="issue530-probe">
    <slot>
      <text class="issue530-fallback-default">issue-530 fallback default</text>
    </slot>
  </view>
</template>

<style>
.issue530-probe {
  padding: 16rpx;
}
</style>
