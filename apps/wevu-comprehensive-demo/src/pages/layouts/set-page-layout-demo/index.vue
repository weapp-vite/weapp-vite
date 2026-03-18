<script setup lang="ts">
import { ref, setPageLayout } from 'wevu'

const currentLayout = ref<'admin' | 'native-shell' | 'none'>('admin')

function applyAdmin() {
  currentLayout.value = 'admin'
  setPageLayout('admin', {
    sidebar: true,
    title: 'Runtime Admin',
  })
}

function applyNative() {
  currentLayout.value = 'native-shell'
  setPageLayout('native-shell', {
    sidebar: true,
    title: 'Runtime Native',
  })
}

function clearLayout() {
  currentLayout.value = 'none'
  setPageLayout(false)
}

function backToLayouts() {
  wx.navigateTo({ url: '/pages/layouts/index' })
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      setPageLayout 动态切换
    </view>

    <view class="section">
      <view class="section-title">
        显式切壳 API
      </view>
      <text class="intro">
        当前页面编译时已注册多个 layout。点击下面按钮会调用 `setPageLayout()`，显式切换页面壳，而不是把
        `layout.name` 做成普通响应式值。
      </text>
      <text class="current">
        current layout: {{ currentLayout }}
      </text>
    </view>

    <view class="section btns">
      <button class="btn btn-success" @tap="applyAdmin">
        切到 admin
      </button>
      <button class="btn btn-info" @tap="applyNative">
        切到 native-shell
      </button>
      <button class="btn btn-warning" @tap="clearLayout">
        取消布局
      </button>
    </view>

    <view class="section">
      <button class="btn btn-primary" @tap="backToLayouts">
        返回布局总览
      </button>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.intro {
  display: block;
  font-size: 26rpx;
  line-height: 1.8;
  color: #475569;
}

.current {
  display: block;
  margin-top: 18rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #0f172a;
}

.btns {
  display: flex;
  gap: 16rpx;
}

.btns .btn {
  flex: 1;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "navigationBarTitleText": "setPageLayout 示例"
}
</json>
