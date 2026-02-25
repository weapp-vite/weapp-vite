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

function jump(url?: string) {
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
        v-for="link in links"
        :key="link.url"
        @tap="jump(link.url)"
      >
        {{ link.text }}
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
