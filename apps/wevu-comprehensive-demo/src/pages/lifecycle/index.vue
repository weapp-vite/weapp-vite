<script lang="ts">
import { onHide, onReady, onShow } from 'wevu'

export default {
  setup({ instance }) {
    // 使用 setup 注册生命周期钩子
    onShow(() => {
      console.log('[Lifecycle] onShow from setup')
    })

    onHide(() => {
      console.log('[Lifecycle] onHide from setup')
    })

    onReady(() => {
      console.log('[Lifecycle] onReady from setup')
    })
  },
  data() {
    return {
      logs: [] as string[],
      showCount: 0,
      hideCount: 0,
    }
  },
  methods: {
    addLog(message: string) {
      this.logs.push(`[${new Date().toLocaleTimeString()}] ${message}`)
    },
    clearLogs() {
      this.logs = []
    },
    navigateBack() {
      wx.navigateBack()
    },
  },
  onLoad() {
    this.addLog('onLoad - 页面加载')
  },
  onShow() {
    this.showCount += 1
    this.addLog(`onShow - 页面显示 (第 ${this.showCount} 次)`)
  },
  onReady() {
    this.addLog('onReady - 页面初次渲染完成')
  },
  onHide() {
    this.hideCount += 1
    this.addLog(`onHide - 页面隐藏 (第 ${this.hideCount} 次)`)
  },
  onUnload() {
    console.log('[Lifecycle] onUnload - 页面卸载')
  },
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      生命周期
    </view>

    <view class="section">
      <view class="section-title">
        统计信息
      </view>
      <view class="stats">
        <view class="stat-item">
          <text class="stat-label">
            显示次数
          </text>
          <text class="stat-value">
            {{ showCount }}
          </text>
        </view>
        <view class="stat-item">
          <text class="stat-label">
            隐藏次数
          </text>
          <text class="stat-value">
            {{ hideCount }}
          </text>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        生命周期日志
      </view>
      <view class="logs-header">
        <text class="logs-count">
          共 {{ logs.length }} 条
        </text>
        <button class="btn-clear" @click="clearLogs">
          清空
        </button>
      </view>
      <view class="logs-list">
        <view v-for="logs" :key="index" class="log-item">
          <text class="log-index">
            {{ index + 1 }}.
          </text>
          <text class="log-text">
            {{ item }}
          </text>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        测试操作
      </view>
      <view class="tip">
        <text class="tip-text">
          点击"返回"按钮将触发 onHide 和 onUnload
        </text>
      </view>
      <button class="btn btn-warning" @click="navigateBack">
        返回上一页
      </button>
    </view>

    <view class="info-box">
      <view class="info-title">
        💡 支持的生命周期钩子
      </view>
      <view class="hook-list">
        <text class="hook-item">
          • onLoad - 页面加载
        </text>
        <text class="hook-item">
          • onShow - 页面显示
        </text>
        <text class="hook-item">
          • onReady - 初次渲染完成
        </text>
        <text class="hook-item">
          • onHide - 页面隐藏
        </text>
        <text class="hook-item">
          • onUnload - 页面卸载
        </text>
        <text class="hook-item">
          • onShareAppMessage - 分享
        </text>
        <text class="hook-item">
          • onPageScroll - 页面滚动
        </text>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.stats {
  display: flex;
  gap: 24rpx;
}

.stat-item {
  flex: 1;
  padding: 32rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12rpx;
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 12rpx;
}

.stat-value {
  display: block;
  font-size: 48rpx;
  color: #fff;
  font-weight: 700;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.logs-count {
  font-size: 26rpx;
  color: #666;
}

.btn-clear {
  padding: 12rpx 24rpx;
  background: #f56c6c;
  color: #fff;
  border-radius: 8rpx;
  font-size: 24rpx;
}

.logs-list {
  max-height: 500rpx;
  overflow-y: auto;
}

.log-item {
  display: flex;
  padding: 16rpx;
  background: #f5f7fa;
  border-radius: 8rpx;
  margin-bottom: 12rpx;
}

.log-index {
  font-size: 24rpx;
  color: #999;
  margin-right: 12rpx;
  min-width: 48rpx;
}

.log-text {
  flex: 1;
  font-size: 26rpx;
  color: #333;
}

.info-box {
  margin-top: 32rpx;
  padding: 24rpx;
  background: #e3f2fd;
  border-radius: 12rpx;
  border-left: 4rpx solid #2196f3;
}

.info-title {
  font-size: 28rpx;
  font-weight: 500;
  color: #1976d2;
  margin-bottom: 16rpx;
}

.hook-list {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.hook-item {
  font-size: 26rpx;
  color: #1565c0;
  line-height: 1.6;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "navigationBarTitleText": "生命周期",
  "navigationBarBackgroundColor": "#00f2fe",
  "navigationBarTextStyle": "white"
}
</json>
