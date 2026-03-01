<template>
  <view class="page-dashboard">
    <text class="title">
      dashboard
    </text>
    <view class="grid">
      <view class="cell">
        <text class="label">
          今日 UV
        </text>
        <text class="value">
          12,842
        </text>
      </view>
      <view class="cell">
        <text class="label">
          转化率
        </text>
        <text class="value">
          8.2%
        </text>
      </view>
      <view class="cell">
        <text class="label">
          新客占比
        </text>
        <text class="value">
          36%
        </text>
      </view>
      <view class="cell">
        <text class="label">
          退款率
        </text>
        <text class="value">
          1.4%
        </text>
      </view>
    </view>
    <view class="notes">
      <text>此页面用于验证 auto-routes 对复杂结构页面的识别与编译输出。</text>
    </view>
  </view>
</template>

<style scoped>
.page-dashboard {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 24rpx;
}

.title {
  font-size: 34rpx;
  font-weight: 600;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12rpx;
}

.cell {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  padding: 12rpx;
  border: 1px solid #e3e9f3;
  border-radius: 12rpx;
}

.label {
  font-size: 22rpx;
  color: #6a7280;
}

.value {
  font-size: 30rpx;
  font-weight: 600;
}

.notes {
  font-size: 22rpx;
  color: #4d596a;
}
</style>
