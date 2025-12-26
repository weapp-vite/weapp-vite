<script lang="ts">
export default {
  type: 'page',
  data() {
    return {
      localCount: 0,
    }
  },
  methods: {
    incrementLocal() {
      this.localCount += 1
    },
  },
}
</script>

<template>
  <view class="container">
    <view class="page-title">状态管理</view>

    <view class="section">
      <view class="section-title">局部状态</view>
      <view class="demo-item">
        <text class="label">局部计数: {{localCount}}</text>
        <button class="btn btn-primary" @click="incrementLocal">+1</button>
      </view>
    </view>

    <view class="tip">
      <text class="tip-text">💡 状态管理示例 - 演示跨页面状态共享</text>
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
  "navigationBarTitleText": "状态管理"
}
</config>
