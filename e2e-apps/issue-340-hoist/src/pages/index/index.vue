<script setup lang="ts">
const routes = [
  '/subpackages/item/login-required/index',
  '/subpackages/user/register/form',
]
</script>

<template>
  <view class="issue340-home">
    <text class="issue340-title">
      issue-340 hoist app
    </text>
    <text
      v-for="route in routes"
      :key="route"
      class="issue340-route"
    >
      {{ route }}
    </text>
  </view>
</template>

<style scoped>
.issue340-home {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #fff;
}

.issue340-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue340-route {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #334155;
}
</style>
