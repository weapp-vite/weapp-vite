<script setup lang="ts">
const entries = [
  {
    desc: '使用 wevu/fetch + wevu/web-apis，验证全局 fetch 与宿主默认参数',
    route: '/pages/request-globals/fetch',
    title: 'fetch',
  },
  {
    desc: '使用 wevu/web-apis 安装 web runtime，验证 graphql-request 对 URL / fetch 的依赖链路',
    route: '/pages/request-globals/graphql-request',
    title: 'graphql-request',
  },
  {
    desc: '使用 wevu/web-apis 安装 web runtime，验证 axios 在小程序中的请求适配能力',
    route: '/pages/request-globals/axios',
    title: 'axios',
  },
]
</script>

<template>
  <view class="page">
    <view class="hero">
      <text class="hero-title">Request Globals 验证导航</text>
      <text class="hero-desc">
        将 fetch、graphql-request、axios 拆到独立页面，分别验证 `wevu/fetch` 与 `wevu/web-apis` 的组合用法
      </text>
    </view>

    <navigator
      v-for="entry in entries"
      :key="entry.route"
      class="card"
      :url="entry.route"
    >
      <text class="card-title">{{ entry.title }}</text>
      <text class="card-desc">{{ entry.desc }}</text>
      <text class="card-link">进入页面</text>
    </navigator>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 32rpx;
  background:
    radial-gradient(circle at top left, rgb(245 158 11 / 18%), transparent 36%),
    linear-gradient(180deg, #fff7ed 0%, #fffbeb 100%);
}

.hero {
  padding: 28rpx;
  margin-bottom: 24rpx;
  background: rgb(255 255 255 / 88%);
  border: 2rpx solid rgb(251 191 36 / 24%);
  border-radius: 28rpx;
}

.hero-title {
  display: block;
  font-size: 38rpx;
  font-weight: 700;
  color: #7c2d12;
}

.hero-desc {
  display: block;
  margin-top: 14rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #9a3412;
}

.card {
  display: block;
  padding: 28rpx;
  margin-top: 20rpx;
  background: rgb(255 255 255 / 90%);
  border: 2rpx solid rgb(249 115 22 / 15%);
  border-radius: 24rpx;
}

.card-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #7c2d12;
}

.card-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #9a3412;
}

.card-link {
  display: block;
  margin-top: 18rpx;
  font-size: 22rpx;
  color: #ea580c;
}
</style>
