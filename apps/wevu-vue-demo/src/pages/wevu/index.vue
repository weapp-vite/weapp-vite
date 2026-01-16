<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'wevu'

definePageJson({
  navigationBarTitleText: 'WeVU .vue Demo Page',
})

const viewRef = ref<unknown>()
const message = ref('WeVU 单文件组件页面')
const count = ref(0)
const todos = ref([
  '由 weapp-vite 内置 Vue 编译自动处理 .vue 文件',
  '点击按钮体验响应式数据',
  '查看控制台 watch 日志',
])

const doubled = computed(() => count.value * 2)

function increment() {
  count.value += 1
}

function reset() {
  count.value = 0
}

watch(count, (newValue, oldValue) => {
  console.log(`[wevu] count changed from ${oldValue} to ${newValue}`)
})

onMounted(() => {
  console.log(viewRef.value)
})
</script>

<template>
  <view ref="viewRef" class="page">
    <view class="header">
      <text class="title">
        {{ message }}
      </text>
    </view>

    <view class="content">
      <view class="counter">
        <text class="label">
          当前计数：{{ count }}
        </text>
        <text class="label">
          双倍计数：{{ doubled }}
        </text>
      </view>

      <view class="actions">
        <button class="btn" bindtap="increment">
          +1
        </button>
        <button class="btn reset" bindtap="reset">
          重置
        </button>
      </view>

      <view class="todo">
        <text class="todo-title">
          Checklist
        </text>
        <view wx:for="{{todos}}" wx:key="index" class="todo-item">
          <text>• {{ item }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 48rpx 32rpx 64rpx;
  background: linear-gradient(180deg, #f5f7ff, #fff);
}

.header {
  margin-bottom: 32rpx;
}

.title {
  font-size: 40rpx;
  font-weight: 600;
  color: #2c2c54;
}

.content {
  padding: 32rpx;
  background: #fff;
  border-radius: 24rpx;
  box-shadow: 0 12rpx 32rpx rgb(44 44 84 / 10%);
}

.counter .label {
  display: block;
  margin-bottom: 12rpx;
  font-size: 32rpx;
  color: #1c1c3c;
}

.actions {
  display: flex;
  gap: 24rpx;
  margin: 32rpx 0;
}

.btn {
  flex: 1;
  line-height: 96rpx;
  color: #fff;
  background: #4c6ef5;
  border-radius: 16rpx;
}

.btn.reset {
  background: #f03e3e;
}

.todo-title {
  margin-bottom: 16rpx;
  font-size: 28rpx;
  font-weight: 500;
}

.todo-item {
  margin-bottom: 12rpx;
  font-size: 26rpx;
  color: #4f4f7a;
}
</style>
