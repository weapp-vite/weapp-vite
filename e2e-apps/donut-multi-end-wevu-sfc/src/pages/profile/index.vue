<script setup lang="ts">
import { computed, ref } from 'wevu'
import { useRoute, useRouter } from 'wevu/router'

definePageJson({
  navigationBarTitleText: 'Wevu 多端资料',
})

const route = useRoute()
const router = useRouter()
const edits = ref(0)
const source = computed(() => {
  const value = route.query.from
  return Array.isArray(value) ? value[0] || '' : value || ''
})
const profile = computed(() => ({
  status: 'loaded',
  entry: 'profile',
  from: source.value,
  edits: edits.value,
}))

function updateProfile() {
  edits.value += 1
}

async function backHome() {
  await router.nativeRouter.reLaunch({
    url: '/pages/index/index',
  })
}
</script>

<template>
  <view class="page">
    <view class="title">
      Profile
    </view>
    <view class="summary">
      <view>Status: {{ profile.status }}</view>
      <view>Entry: {{ profile.entry }}</view>
      <view>From: {{ profile.from }}</view>
      <view>Edits: {{ profile.edits }}</view>
    </view>
    <button class="action" @tap="updateProfile">
      Update profile
    </button>
    <button class="action action--light" @tap="backHome">
      Back home
    </button>
  </view>
</template>

<style>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 32rpx;
  background: #fff;
}

.title {
  font-size: 40rpx;
  font-weight: 700;
  color: #0f172a;
}

.summary {
  padding: 24rpx;
  margin-top: 20rpx;
  font-size: 26rpx;
  line-height: 1.8;
  color: #334155;
  background: #f8fafc;
  border: 2rpx solid #e2e8f0;
  border-radius: 16rpx;
}

.action {
  margin-top: 20rpx;
  color: #fff;
  background: #1d4ed8;
  border-radius: 999rpx;
}

.action--light {
  color: #0f172a;
  background: #e2e8f0;
}
</style>
