<script setup lang="ts">
import { ref } from 'wevu'

const count = ref(0)
const list = ref(['alpha', 'beta', 'gamma'])

function increment() {
  count.value += 1
}

function reverse() {
  list.value = [...list.value].reverse()
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      Render / Template
    </view>

    <view class="section">
      <view class="section-title">
        使用 wevu（不引入 vue）
      </view>
      <view class="card">
        <text>count: {{ count }}</text>
        <view class="actions">
          <button class="btn btn-primary" @click="increment">
            +1
          </button>
          <button class="btn btn-warning" @click="reverse">
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
  background: #ffffff;
  border: 1rpx solid #e2e8f0;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "navigationBarTitleText": "Render / Template"
}
</json>
