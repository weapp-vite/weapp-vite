<script setup lang="ts">
import { onShow, ref } from 'wevu'

// 直接定义响应式数据
const count = ref(0)
const message = ref('Script Setup')
const items = ref(['项目1', '项目2', '项目3'])

// 定义方法
function increment() {
  count.value += 1
}

function updateMessage() {
  message.value = `更新于 ${new Date().toLocaleTimeString()}`
}

function addItem() {
  items.value.push(`项目 ${items.value.length + 1}`)
}

// 生命周期钩子
onShow(() => {
  console.log('[ScriptSetup] 页面显示')
})
</script>

<template>
  <view class="container">
    <view class="page-title">
      Script Setup
    </view>

    <view class="section">
      <view class="section-title">
        响应式数据
      </view>
      <view class="demo-item">
        <text class="label">
          计数: {{ count }}
        </text>
        <button class="btn btn-primary" @click="increment">
          +1
        </button>
      </view>
      <view class="demo-item">
        <text class="label">
          {{ message }}
        </text>
        <button class="btn btn-primary" @click="updateMessage">
          更新
        </button>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        数组操作
      </view>
      <view class="items-list">
        <view v-for="(item, index) in items" :key="index" class="item-row">
          <text>{{ item }}</text>
        </view>
      </view>
      <button class="btn btn-success" @click="addItem">
        添加项目
      </button>
    </view>

    <view class="tip">
      <text class="tip-text">
        💡 Script Setup 提供更简洁的语法，顶层变量自动暴露
      </text>
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

.items-list {
  margin: 24rpx 0;
}

.item-row {
  padding: 16rpx;
  background: #f5f7fa;
  border-radius: 8rpx;
  margin-bottom: 12rpx;
  font-size: 26rpx;
}
/* stylelint-enable order/properties-order */
</style>

<config lang="json">
{
  "navigationBarTitleText": "Script Setup"
}
</config>
