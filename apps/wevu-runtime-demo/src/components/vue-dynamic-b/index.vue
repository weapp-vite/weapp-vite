<script setup lang="ts">
const meta = {
  title: 'Dynamic B',
  subtitle: '用于演示 keep-alive / transition 等组合写法',
}
</script>

<template>
  <view class="card">
    <text class="title">{{ meta.title }}</text>
    <text class="subtitle">{{ meta.subtitle }}</text>
    <view class="grid">
      <view v-for="n in 6" :key="n" class="pill">
        <text>#{{ n }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
/* stylelint-disable order/properties-order */
.card {
  padding: 20rpx;
  border-radius: 16rpx;
  background: linear-gradient(135deg, #e0f2fe 0%, #fae8ff 100%);
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.06);
}

.title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.subtitle {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #475569;
}

.grid {
  margin-top: 16rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.pill {
  padding: 10rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.8);
  font-size: 24rpx;
  color: #334155;
}
/* stylelint-enable order/properties-order */
</style>
