<script setup lang="ts">
const pages = [
  {
    title: 'fetch',
    route: '/pages/fetch/index',
    desc: '原生 fetch + request globals 实际请求',
  },
  {
    title: 'axios',
    route: '/pages/axios/index',
    desc: 'axios 通过 request globals / XHR 适配访问本地服务',
  },
  {
    title: 'graphql-request',
    route: '/pages/graphql-request/index',
    desc: 'graphql-request 访问本地 GraphQL endpoint',
  },
  {
    title: 'vue-query',
    route: '/pages/vue-query/index',
    desc: '@tanstack/vue-query + 实时接口 + query key/refetch',
  },
  {
    title: 'socket.io-client',
    route: '/pages/socket-io/index',
    desc: 'socket.io-client 通过真实 Socket.IO 服务端验证 websocket 链路',
  },
]
</script>

<template>
  <view class="page">
    <view class="hero">
      <text class="hero-title">Request Clients Real E2E</text>
      <text class="hero-desc">本 app 用于验证 fetch / axios / graphql-request / vue-query / socket.io-client 的真实请求链路。</text>
    </view>

    <view v-for="item in pages" :key="item.route" class="card">
      <text class="card-title">{{ item.title }}</text>
      <text class="card-desc">{{ item.desc }}</text>
      <text class="card-route mono">{{ item.route }}</text>
    </view>
  </view>
</template>

<style>
.page {
  min-height: 100vh;
  padding: 28rpx;
  background: linear-gradient(180deg, #e2e8f0 0%, #f8fafc 100%);
}

.hero,
.card {
  padding: 24rpx;
  margin-bottom: 20rpx;
  background: rgb(255 255 255 / 92%);
  border-radius: 24rpx;
  box-shadow: 0 16rpx 40rpx rgb(15 23 42 / 8%);
}

.hero-title,
.card-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.hero-desc,
.card-desc,
.card-route {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #334155;
}

.mono {
  font-family: Monaco, monospace;
}
</style>
