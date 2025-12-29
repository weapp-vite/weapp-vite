<script setup lang="ts">
import { ref } from 'wevu'

const active = ref(true)
const highlight = ref(false)

function toggleActive() {
  active.value = !active.value
}

function toggleHighlight() {
  highlight.value = !highlight.value
}
</script>

<template>
  <view class="container">
    <view class="page-title">样式写法覆盖</view>

    <view class="section">
      <view class="section-title">scoped / module / 普通 style</view>
      <view class="demo-item">
        <text class="label">active: {{ active }}</text>
        <button class="btn btn-primary" @click="toggleActive">切换</button>
      </view>
      <view class="demo-item">
        <text class="label">highlight: {{ highlight }}</text>
        <button class="btn btn-success" @click="toggleHighlight">切换</button>
      </view>

      <view class="card" :class="[active ? 'active' : 'inactive', $style.moduleBox, { [$style.highlight]: highlight }]">
        <text class="title">CSS Modules: $style.xxx</text>
        <text class="muted">同时使用 :class array/object + module class</text>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.card {
  padding: 18rpx;
  border-radius: 16rpx;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.title {
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.muted {
  font-size: 22rpx;
  color: #64748b;
}
/* stylelint-enable order/properties-order */
</style>

<style scoped>
/* stylelint-disable order/properties-order */
.active {
  border: 2rpx solid #22c55e;
}

.inactive {
  border: 2rpx solid #e2e8f0;
}
/* stylelint-enable order/properties-order */
</style>

<style module>
.moduleBox {
  box-shadow: 0 16rpx 40rpx rgba(0, 0, 0, 0.08);
}

.highlight {
  background: #fff7ed;
}
</style>

<config lang="json">
{
  "navigationBarTitleText": "样式写法"
}
</config>
