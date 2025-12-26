<script lang="ts">
export default {
  data() {
    return {
      message: '这是父组件的数据',
      count: 0,
    }
  },
  methods: {
    handleIncrement() {
      this.count += 1
    },
  },
}
</script>

<template>
  <view class="container">
    <view class="page-title">组件通信</view>

    <view class="section">
      <view class="section-title">父子组件通信</view>
      <view class="demo-item">
        <text class="label">父组件数据: {{message}}</text>
      </view>
      <view class="demo-item">
        <text class="label">计数: {{count}}</text>
        <button class="btn btn-primary" @click="handleIncrement">+1</button>
      </view>
    </view>

    <view class="tip">
      <text class="tip-text">💡 组件通信示例 - 需要先创建可复用组件</text>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.demo-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #eee;
}

.label {
  font-size: 28rpx;
  color: #333;
}
/* stylelint-enable order/properties-order */
</style>

<config lang="json">
{
  "navigationBarTitleText": "组件通信"
}
</config>
