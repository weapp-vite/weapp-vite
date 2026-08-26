<script lang="ts">
export default {
  data() {
    return {
      message: '这是父组件的数据',
      count: 0,
      inlineStatus: '',
      inlineEventType: '',
      inlineTarget: '',
    }
  },
  methods: {
    handleIncrement() {
      this.count += 1
    },
    handleInline(status: string, event: any) {
      this.inlineStatus = status
      this.inlineEventType = event?.type ?? 'unknown'
      this.inlineTarget = event?.currentTarget?.id ?? ''
    },
  },
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      组件通信
    </view>

    <view class="section">
      <view class="section-title">
        父子组件通信
      </view>
      <view class="demo-item">
        <text class="label">
          父组件数据: {{ message }}
        </text>
      </view>
      <view class="demo-item">
        <text class="label">
          计数: {{ count }}
        </text>
        <button class="btn btn-primary" @click="handleIncrement">
          +1
        </button>
      </view>

      <view class="demo-item">
        <view>
          <text class="label">
            内联事件
          </text>
          <view class="sub-text">
            状态: {{ inlineStatus || '未触发' }}
          </view>
          <view class="sub-text">
            事件: {{ inlineEventType || '暂无' }}
          </view>
          <view class="sub-text">
            目标: {{ inlineTarget || '无' }}
          </view>
        </view>
        <button id="inline-btn" class="btn btn-info" @click="handleInline('ok', $event)">
          触发 inline 事件
        </button>
      </view>
    </view>

    <view class="tip">
      <text class="tip-text">
        💡 组件通信示例 - 需要先创建可复用组件
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
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "$schema": "https://vite.weapp.dev/page.json",
  "navigationBarTitleText": "组件通信",
  "navigationBarBackgroundColor": "#f093fb",
  "navigationBarTextStyle": "white"
}
</json>
