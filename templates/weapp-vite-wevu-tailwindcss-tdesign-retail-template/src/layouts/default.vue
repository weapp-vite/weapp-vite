<script setup lang="ts">
import { computed, useNavigationBarMetrics, usePageStack } from 'wevu'
import { wpi } from 'wevu/api'
import { navigationTitleMap, tabRoutes } from '@/config/navigation'

const {
  navigationBarHeight,
  navigationHeight,
  statusBarHeight,
} = useNavigationBarMetrics()
const {
  canGoBack,
  currentRoute,
} = usePageStack()

const navigationTitle = computed(() => navigationTitleMap[currentRoute.value] || 'Weixin')
const isTabRoute = computed(() => tabRoutes.has(currentRoute.value))
const showLeftAction = computed(() => canGoBack.value || !isTabRoute.value)
const leftIconName = computed(() => canGoBack.value ? 'chevron-left' : 'home')

async function handleLeftAction() {
  if (canGoBack.value) {
    await wpi.navigateBack()
    return
  }
  await wpi.switchTab({
    url: '/pages/home/home',
  })
}

defineComponentJson({
  component: true,
  usingComponents: {
    't-icon': 'tdesign-miniprogram/icon/icon',
    't-dialog': 'tdesign-miniprogram/dialog/dialog',
    't-toast': 'tdesign-miniprogram/toast/toast',
  },
})
</script>

<template>
  <view class="layout-default">
    <view
      class="layout-navigation"
      :style="`height: ${navigationHeight}px; padding-top: ${statusBarHeight}px;`"
    >
      <view class="layout-navigation__bar" :style="`height: ${navigationBarHeight}px;`">
        <view class="layout-navigation__side layout-navigation__side--left">
          <view
            v-if="showLeftAction"
            class="layout-navigation__button"
            hover-class="layout-navigation__button--active"
            @tap="handleLeftAction"
          >
            <t-icon :name="leftIconName" size="42rpx" color="#222427" />
          </view>
        </view>
        <view class="layout-navigation__title">
          {{ navigationTitle }}
        </view>
        <view class="layout-navigation__side" />
      </view>
    </view>
    <slot />
    <t-toast layout-host="layout-toast" />
    <t-dialog layout-host="layout-dialog" />
  </view>
</template>

<style>
.layout-default {
  min-height: 100%;
}

.layout-navigation {
  position: relative;
  z-index: 50;
  box-sizing: border-box;
  width: 100%;
  background: #fff;
  border-bottom: 1rpx solid #eee;
}

.layout-navigation__bar {
  display: flex;
  align-items: center;
  width: 100%;
}

.layout-navigation__side {
  display: flex;
  flex: 0 0 176rpx;
  align-items: center;
  min-width: 176rpx;
  height: 100%;
}

.layout-navigation__side--left {
  justify-content: flex-start;
}

.layout-navigation__button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88rpx;
  height: 88rpx;
  margin-left: 8rpx;
}

.layout-navigation__button--active {
  opacity: 0.55;
}

.layout-navigation__title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 32rpx;
  font-weight: 600;
  line-height: 44rpx;
  color: #222427;
  text-align: center;
  white-space: nowrap;
}
</style>
