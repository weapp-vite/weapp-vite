<template>
  <view class="page-detail">
    <text class="title">
      detail
    </text>
    <text>ID：42</text>
    <text>来源：home</text>
    <text>摘要：detail#42@home</text>
    <text class="hint">
      该页面用于验证 query 场景下的路由跳转地址生成。
    </text>
  </view>
</template>

<style scoped>
.page-detail {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 24rpx;
}

.title {
  font-size: 34rpx;
  font-weight: 600;
}

.hint {
  font-size: 22rpx;
  color: #5f6878;
}
</style>
