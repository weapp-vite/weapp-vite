<script setup lang="ts">
import { computed, ref, watch } from 'wevu'

definePageJson({
  navigationStyle: 'custom',
  navigationBarTitleText: '首页',
})

const count = ref(0)
const message = ref('Hello WeVU!')
const todos = ref([
  '用 Vue SFC 写页面/组件',
  '用 wevu API（ref/computed/watch）写逻辑',
  '用 v-for / v-if / @tap / v-model 写模板',
])

const doubled = computed(() => count.value * 2)

function increment() {
  count.value += 1
}

function reset() {
  count.value = 0
}

watch(count, (newValue, oldValue) => {
  console.log(`[wevu] count changed: ${oldValue} -> ${newValue}`)
})
</script>

<template>
  <view class="page">
    <Navbar :title="message" :subtitle="`count=${count}, doubled=${doubled}`">
      <template #right>
        <button class="mini-btn" @tap.stop="reset">
          重置
        </button>
      </template>
    </Navbar>

    <HelloWorld :title="message" :subtitle="`HelloWorld 组件，count=${count}`" />

    <view class="card">
      <view class="row">
        <text class="label">
          当前计数：{{ count }}
        </text>
        <text class="label">
          双倍：{{ doubled }}
        </text>
      </view>

      <view class="row actions">
        <button class="btn primary" @tap.catch="increment">
          +1
        </button>
        <button class="btn danger" @tap.stop="reset">
          重置
        </button>
      </view>

      <view class="row">
        <text class="label">
          文本双向绑定：
        </text>
      </view>
      <input v-model="message" class="input" placeholder="输入标题…">

      <view class="row">
        <text class="label">
          Checklist
        </text>
      </view>
      <view class="todo">
        <view v-for="(todo, index) in todos" :key="index" class="todo-item">
          <text>• {{ todo }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 20rpx 32rpx 64rpx;
  background: #f6f7ff;
}

.card {
  padding: 32rpx;
  margin-top: 24rpx;
  background: #fff;
  border-radius: 24rpx;
  box-shadow: 0 12rpx 32rpx rgb(44 44 84 / 10%);
}

.row {
  display: flex;
  gap: 16rpx;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.label {
  font-size: 30rpx;
  color: #1c1c3c;
}

.actions {
  margin: 24rpx 0;
}

.btn {
  flex: 1;
  line-height: 96rpx;
  color: #fff;
  border-radius: 16rpx;
}

.btn.primary {
  background: #4c6ef5;
}

.btn.danger {
  background: #f03e3e;
}

.mini-btn {
  min-width: 124rpx;
  height: 64rpx;
  padding: 0 20rpx;
  margin: 0;
  font-size: 24rpx;
  line-height: 64rpx;
  color: #4c6ef5;
  background: #fff;
  border-radius: 14rpx;
}

.mini-btn::after {
  border: 0;
}

.input {
  box-sizing: border-box;
  height: 88rpx;
  padding: 0 24rpx;
  margin: 0 0 24rpx;
  background: #fff;
  border: 2rpx solid #e9ecef;
  border-radius: 16rpx;
}

.todo-item {
  margin-bottom: 12rpx;
  font-size: 26rpx;
  color: #4f4f7a;
}
</style>
