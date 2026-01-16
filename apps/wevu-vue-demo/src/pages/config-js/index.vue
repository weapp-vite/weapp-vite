<script setup lang="ts">
import { ref } from 'wevu'

const config = {
  navigationBarTitleText: 'JS Config Demo',
  disableScroll: false,
  backgroundColor: '#ffffff',
}

definePageJson(config)

const slogan = ref('使用 JavaScript 编写页面配置')
const links = ref([
  { text: '查看 TS 版本', url: '/pages/config-ts/index' },
  { text: '返回主示例', url: '/pages/wevu/index' },
])

interface JumpEvent {
  currentTarget?: {
    dataset?: {
      url?: string
    }
  }
}

function jump(event?: JumpEvent) {
  const url = event?.currentTarget?.dataset?.url
  if (url) {
    wx.navigateTo({ url })
  }
}
</script>

<template>
  <view class="page">
    <text class="title">
      {{ slogan }}
    </text>
    <view class="links">
      <button
        wx:for="{{links}}"
        wx:key="url"
        bindtap="jump"
        data-url="{{ item.url }}"
      >
        {{ item.text }}
      </button>
    </view>
  </view>
</template>

<style>
.page {
  padding: 48rpx 32rpx;
}

.title {
  margin-bottom: 24rpx;
  font-size: 36rpx;
  font-weight: 600;
}

.links button {
  margin-bottom: 16rpx;
}
</style>
