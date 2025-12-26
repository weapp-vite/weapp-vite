<script lang="ts">
export default {
  data() {
    return {
      keyword: '',
      count: 0,
      user: {
        name: '张三',
        age: 25,
      },
      logs: [] as string[],
    }
  },
  watch: {
    // 基础侦听器
    keyword(newVal: string, oldVal: string) {
      this.addLog(`关键词变化: "${oldVal}" -> "${newVal}"`)
    },
    // 立即执行
    count: {
      handler(newVal: number, oldVal: number) {
        this.addLog(`计数变化: ${oldVal} -> ${newVal}`)
      },
      immediate: true,
    },
    // 深度侦听
    user: {
      handler(newVal: any, oldVal: any) {
        this.addLog(`用户信息变化: ${JSON.stringify(oldVal)} -> ${JSON.stringify(newVal)}`)
      },
      deep: true,
    },
  },
  methods: {
    updateKeyword() {
      this.keyword = `搜索${Date.now()}`
    },
    increment() {
      this.count += 1
    },
    updateUserName() {
      this.user.name = '李四'
    },
    updateUserAge() {
      this.user.age += 1
    },
    addLog(message: string) {
      this.logs.unshift(`[${new Date().toLocaleTimeString()}] ${message}`)
      if (this.logs.length > 10) {
        this.logs = this.logs.slice(0, 10)
      }
    },
    clearLogs() {
      this.logs = []
    },
  },
}
</script>

<template>
  <view class="container">
    <view class="page-title">侦听器</view>

    <view class="section">
      <view class="section-title">基础 Watch</view>
      <view class="demo-item">
        <text class="label">关键词: {{keyword || '(空)'}}</text>
        <button class="btn btn-primary" @click="updateKeyword">修改</button>
      </view>
    </view>

    <view class="section">
      <view class="section-title">Immediate Watch (立即执行)</view>
      <view class="demo-item">
        <text class="label">计数: {{count}}</text>
        <button class="btn btn-success" @click="increment">+1</button>
      </view>
    </view>

    <view class="section">
      <view class="section-title">Deep Watch (深度侦听)</view>
      <view class="demo-item">
        <text class="label">姓名: {{user.name}}</text>
        <button class="btn btn-info" @click="updateUserName">修改</button>
      </view>
      <view class="demo-item">
        <text class="label">年龄: {{user.age}}</text>
        <button class="btn btn-info" @click="updateUserAge">+1</button>
      </view>
    </view>

    <view class="section">
      <view class="section-title">侦听日志</view>
      <view class="logs-header">
        <text class="logs-title">变化记录 ({{logs.length}})</text>
        <button class="btn-clear" @click="clearLogs">清空</button>
      </view>
      <view class="logs-list">
        <view wx:if="{{logs.length === 0}}" class="empty-log">
          <text>暂无日志</text>
        </view>
        <view v-for="logs" :key="index" class="log-item">
          <text class="log-text">{{item}}</text>
        </view>
      </view>
    </view>

    <view class="tip">
      <text class="tip-text">💡 Watch 可以侦听数据变化并执行副作用</text>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.logs-title {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
}

.btn-clear {
  padding: 12rpx 24rpx;
  background: #f56c6c;
  color: #fff;
  border-radius: 8rpx;
  font-size: 24rpx;
}

.logs-list {
  max-height: 600rpx;
  overflow-y: auto;
}

.empty-log {
  padding: 48rpx;
  text-align: center;
  color: #999;
  font-size: 26rpx;
}

.log-item {
  padding: 16rpx;
  background: #f5f7fa;
  border-radius: 8rpx;
  margin-bottom: 12rpx;
  border-left: 4rpx solid #409eff;
}

.log-text {
  font-size: 24rpx;
  color: #666;
  word-break: break-all;
}
/* stylelint-enable order/properties-order */
</style>

<config lang="js">
export default {
  // 页面标题
  navigationBarTitleText: '侦听器',
  // 导航栏背景色
  navigationBarBackgroundColor: '#4facfe',
  // 导航栏文字颜色
  navigationBarTextStyle: 'white',
}
</config>
