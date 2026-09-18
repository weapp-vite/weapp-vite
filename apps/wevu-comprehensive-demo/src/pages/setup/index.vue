<script lang="ts">
import { defineComponent, onShow, ref } from 'wevu'

export default defineComponent({
  setup() {
    const setupCount = ref(0)
    const message = ref('Setup 初始化')

    onShow(() => {
      console.log('[Setup] 页面显示')
    })

    function incrementSetup() {
      setupCount.value += 1
    }

    function updateMessage() {
      message.value = `更新于 ${new Date().toLocaleTimeString()}`
    }

    return {
      setupCount,
      message,
      incrementSetup,
      updateMessage,
    }
  },
  data() {
    return {
      optionsCount: 0,
    }
  },
  methods: {
    incrementOptions() {
      this.optionsCount += 1
    },
  },
})
</script>

<template>
  <view class="container">
    <view class="page-title">
      Setup 语法
    </view>

    <view class="section">
      <view class="section-title">
        Setup 返回的数据
      </view>
      <view class="demo-item">
        <text class="label">
          Setup 计数: {{ setupCount }}
        </text>
        <button class="btn btn-primary" @click="incrementSetup">
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
        Options API 数据
      </view>
      <view class="demo-item">
        <text class="label">
          Options 计数: {{ optionsCount }}
        </text>
        <button class="btn btn-success" @click="incrementOptions">
          +1
        </button>
      </view>
    </view>

    <view class="tip">
      <text class="tip-text">
        💡 Setup 可以访问运行时上下文，返回的数据和方法会自动绑定到实例
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

.demo-item:last-child {
  border-bottom: none;
}

.label {
  font-size: 28rpx;
  color: #333;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "navigationBarTitleText": "Setup 语法"
}
</json>
