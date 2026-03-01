<template>
  <view class="page-campaign">
    <text class="title">
      marketing/campaign
    </text>
    <view class="row">
      <text>活动名：</text><text>春季促销</text>
    </view>
    <view class="row">
      <text>渠道：</text><text>mini</text>
    </view>
    <view class="row">
      <text>预算：</text><text>120w</text>
    </view>
    <view class="row">
      <text>状态：</text><text>待扩量</text>
    </view>
  </view>
</template>

<style scoped>
.page-campaign {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 24rpx;
}

.title {
  font-size: 34rpx;
  font-weight: 600;
}

.row {
  display: flex;
  gap: 8rpx;
}
</style>
