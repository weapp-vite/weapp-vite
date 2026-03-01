<template>
  <view class="page-lab">
    <text class="title">
      lab/state-playground
    </text>
    <view class="panel">
      <text>实验点 A：class/style 组合</text>
      <text>实验点 B：模板嵌套结构</text>
      <text>实验点 C：分包路由识别</text>
    </view>
  </view>
</template>

<style scoped>
.page-lab {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 24rpx;
}

.title {
  font-size: 34rpx;
  font-weight: 600;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding: 14rpx;
  background: #f4f7ff;
  border-radius: 12rpx;
}
</style>
