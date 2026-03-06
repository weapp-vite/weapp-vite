<script setup lang="ts">
import { useTemplateRef } from 'wevu'
import RouterOriginProbe from '../../../components/router-origin-probe/index.vue'

interface RouterOriginProbeExposed {
  navByRouter: () => void
  navByPageRouter: () => void
}

const probeRef = useTemplateRef<RouterOriginProbeExposed>('routerOriginProbe')

function getPreviousPage() {
  const stack = getCurrentPages()
  if (!Array.isArray(stack) || stack.length < 2) {
    return null
  }
  return stack[stack.length - 2] as Record<string, any>
}

function callPrevWxFromIndex() {
  const previousPage = getPreviousPage()
  previousPage?.triggerWxRelativeFromIndex?.()
}

function callPrevPageRouterFromIndex() {
  const previousPage = getPreviousPage()
  previousPage?.triggerPageRouterRelativeFromIndex?.()
}

function runComponentRouterFromProbe() {
  probeRef.value?.navByRouter?.()
}

function runComponentPageRouterFromProbe() {
  probeRef.value?.navByPageRouter?.()
}

const _callPrevWxFromIndex = callPrevWxFromIndex
const _callPrevPageRouterFromIndex = callPrevPageRouterFromIndex
const _runComponentRouterFromProbe = runComponentRouterFromProbe
const _runComponentPageRouterFromProbe = runComponentPageRouterFromProbe
</script>

<template>
  <view class="router-sub-page">
    <view class="router-sub-page__title">
      router stability (sub page)
    </view>
    <view class="router-sub-page__desc">
      本页会调用上一个页面的方法，验证相对路径基准是否稳定。
    </view>

    <view id="router-sub-call-prev-wx" class="router-sub-page__btn" @tap="callPrevWxFromIndex">
      调用上页 wx.navigateTo('./target/index')
    </view>
    <view id="router-sub-call-prev-page-router" class="router-sub-page__btn" @tap="callPrevPageRouterFromIndex">
      调用上页 pageRouter.navigateTo('./target/index')
    </view>

    <RouterOriginProbe
      ref="routerOriginProbe"
      title="component router origin probe"
    />

    <view id="router-sub-call-component-router" class="router-sub-page__btn" @tap="runComponentRouterFromProbe">
      组件 this.router.navigateTo('./target/index')
    </view>
    <view id="router-sub-call-component-page-router" class="router-sub-page__btn" @tap="runComponentPageRouterFromProbe">
      组件 this.pageRouter.navigateTo('./target/index')
    </view>
  </view>
</template>

<style scoped>
.router-sub-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #f8fafc;
}

.router-sub-page__title {
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.router-sub-page__desc {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #475569;
}

.router-sub-page__btn {
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
