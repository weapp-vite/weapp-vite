<script setup lang="ts">
import { ref } from 'wevu'

defineComponentJson({
  component: true,
})

const active = ref(0)

const tabs = [
  {
    icon: 'home',
    text: '首页',
    url: 'pages/home/home',
  },
  {
    icon: 'app',
    text: '分类',
    url: 'pages/category/index',
  },
  {
    icon: 'cart',
    text: '购物车',
    url: 'pages/cart/index',
  },
  {
    icon: 'user',
    text: '我的',
    url: 'pages/usercenter/index',
  },
]

function onChange(event: any) {
  const index = Number(event?.detail?.value || 0)
  active.value = index
  const tab = tabs[index]
  if (!tab) {
    return
  }
  wx.switchTab({
    url: `/${tab.url}`,
  })
}
</script>

<template>
  <t-tab-bar :value="active" :split="false" @change="onChange">
    <t-tab-bar-item v-for="item in tabs" :key="item.url">
      <view class="custom-tab-bar-wrapper">
        <t-icon :name="item.icon" size="44rpx" />
        <text class="text">
          {{ item.text }}
        </text>
      </view>
    </t-tab-bar-item>
  </t-tab-bar>
</template>

<style>
.custom-tab-bar-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.custom-tab-bar-wrapper .text {
  margin-top: 4rpx;
  font-size: 20rpx;
}
</style>
