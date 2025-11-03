<script lang="ts">
export default {
  type: 'page',
  data() {
    return {
      message: 'WeVU 单文件组件页面',
      count: 0,
      todos: [
        '由 @weapp-vite/plugin-wevu 自动编译 .vue 文件',
        '点击按钮体验响应式数据',
        '查看控制台 watch 日志',
      ],
    }
  },
  computed: {
    doubled(): number {
      return this.count * 2
    },
  },
  methods: {
    increment() {
      this.count += 1
    },
    reset() {
      this.count = 0
    },
  },
  watch: {
    count(newValue: number, oldValue: number) {
      console.log(`[wevu] count changed from ${oldValue} to ${newValue}`)
    },
  },
}
</script>

<template>
  <view class="page">
    <view class="header">
      <text class="title">{{ message }}</text>
    </view>

    <view class="content">
      <view class="counter">
        <text class="label">当前计数：{{ count }}</text>
        <text class="label">双倍计数：{{ doubled }}</text>
      </view>

      <view class="actions">
        <button class="btn" bindtap="increment">+1</button>
        <button class="btn reset" bindtap="reset">重置</button>
      </view>

      <view class="todo">
        <text class="todo-title">Checklist</text>
        <view wx:for="{{todos}}" wx:key="index" class="todo-item">
          <text>• {{ item }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style>
.page {
  min-height: 100vh;
  background: linear-gradient(180deg, #f5f7ff, #ffffff);
  padding: 48rpx 32rpx 64rpx;
  box-sizing: border-box;
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
  background: #ffffff;
  border-radius: 24rpx;
  box-shadow: 0 12rpx 32rpx rgba(44, 44, 84, 0.1);
  padding: 32rpx;
}

.counter .label {
  display: block;
  font-size: 32rpx;
  color: #1c1c3c;
  margin-bottom: 12rpx;
}

.actions {
  display: flex;
  gap: 24rpx;
  margin: 32rpx 0;
}

.btn {
  flex: 1;
  line-height: 96rpx;
  border-radius: 16rpx;
  background: #4c6ef5;
  color: #ffffff;
}

.btn.reset {
  background: #f03e3e;
}

.todo-title {
  font-size: 28rpx;
  font-weight: 500;
  margin-bottom: 16rpx;
}

.todo-item {
  font-size: 26rpx;
  color: #4f4f7a;
  margin-bottom: 12rpx;
}
</style>

<config lang="json">
{
  "navigationBarTitleText": "WeVU .vue Demo Page"
}
</config>
