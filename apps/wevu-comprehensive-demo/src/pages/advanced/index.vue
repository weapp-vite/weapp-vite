<script lang="ts">
export default {
  type: 'page',
  data() {
    return {
      features: [
        '全局属性注册',
        '插件系统',
        '性能优化',
        '错误处理',
        '类型推导',
      ],
    }
  },
}
</script>

<template>
  <view class="container">
    <view class="page-title">高级特性</view>

    <view class="section">
      <view class="section-title">功能列表</view>
      <view class="feature-list">
        <view wx:for="{{features}}" wx:key="index" class="feature-item">
          <text class="feature-icon">🚀</text>
          <text class="feature-text">{{item}}</text>
        </view>
      </view>
    </view>

    <view class="tip">
      <text class="tip-text">💡 这些高级特性帮助构建更强大的应用</text>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.feature-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.feature-item {
  display: flex;
  align-items: center;
  padding: 24rpx;
  background: #f5f7fa;
  border-radius: 8rpx;
}

.feature-icon {
  font-size: 40rpx;
  margin-right: 24rpx;
}

.feature-text {
  font-size: 28rpx;
  color: #333;
}
/* stylelint-enable order/properties-order */
</style>

<config lang="json">
{
  "navigationBarTitleText": "高级特性"
}
</config>
