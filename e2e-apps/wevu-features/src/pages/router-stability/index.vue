<script setup lang="ts">
import { useNativeInstance } from 'wevu'

const nativeInstance = useNativeInstance()

function openSubPage() {
  wx.navigateTo({
    url: '/pages/router-stability/sub/index',
  })
}

function triggerWxRelativeFromIndex() {
  wx.navigateTo({
    url: './target/index?source=wx-from-index',
  })
}

function triggerPageRouterRelativeFromIndex() {
  nativeInstance.pageRouter?.navigateTo({
    url: './target/index?source=page-router-from-index',
  })
}

const _openSubPage = openSubPage
const _triggerWxRelativeFromIndex = triggerWxRelativeFromIndex
const _triggerPageRouterRelativeFromIndex = triggerPageRouterRelativeFromIndex
</script>

<template>
  <view class="router-stability-page">
    <view class="router-stability-page__title">
      router stability (page context)
    </view>
    <view class="router-stability-page__desc">
      用于验证 wx.navigateTo 与 this.pageRouter.navigateTo 的相对路径基准差异。
    </view>

    <view id="router-open-sub" class="router-stability-page__btn" @tap="openSubPage">
      打开 sub 页面
    </view>

    <view id="router-index-wx" class="router-stability-page__btn" @tap="triggerWxRelativeFromIndex">
      当前页触发 wx.navigateTo('./target/index')
    </view>

    <view id="router-index-page-router" class="router-stability-page__btn" @tap="triggerPageRouterRelativeFromIndex">
      当前页触发 pageRouter.navigateTo('./target/index')
    </view>
  </view>
</template>

<style scoped>
.router-stability-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #f8fafc;
}

.router-stability-page__title {
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.router-stability-page__desc {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #475569;
}

.router-stability-page__btn {
  min-height: 60rpx;
  padding: 0 18rpx;
  margin-top: 14rpx;
  font-size: 22rpx;
  line-height: 60rpx;
  color: #1e293b;
  background: #e2e8f0;
  border-radius: 9999rpx;
}
</style>
