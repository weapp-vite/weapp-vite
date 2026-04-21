<script setup lang="ts">
import { ref } from 'wevu'

const count = ref(0)
const list = ref(['alpha', 'beta', 'gamma'])

function increment() {
  count.value += 1
}

function shuffle() {
  list.value = [...list.value].reverse()
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      Render 覆盖
    </view>

    <view class="section">
      <view class="section-title">
        使用模板模拟原 render() 示例
      </view>
      <view class="card">
        <text>count: {{ count }}</text>
        <view class="actions">
          <button class="btn btn-primary" @tap="increment">
            +1
          </button>
          <button class="btn btn-warning" @tap="shuffle">
            reverse
          </button>
        </view>
        <view v-for="item in list" :key="item" class="pill">
          <text>{{ item }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.container {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  box-sizing: border-box;
}

.page-title {
  font-size: 34rpx;
  font-weight: 700;
}

.section {
  background: #fff;
  border-radius: 16rpx;
  padding: 18rpx;
  box-shadow: 0 8rpx 24rpx rgb(0 0 0 / 6%);
}

.section-title {
  font-size: 28rpx;
  font-weight: 700;
  margin-bottom: 12rpx;
}

.btn {
  padding: 14rpx 18rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
}

.btn-primary {
  background: #111827;
  color: #fff;
}

.btn-warning {
  background: #f59e0b;
  color: #111827;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 16rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.actions {
  display: flex;
  gap: 12rpx;
}

.pill {
  padding: 12rpx;
  border-radius: 12rpx;
  background: #fff;
  border: 1rpx solid #e2e8f0;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "navigationBarTitleText": "Render 覆盖",
  "navigationBarBackgroundColor": "#111827",
  "navigationBarTextStyle": "white"
}
</json>
