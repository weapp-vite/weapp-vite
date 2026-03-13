<script setup lang="ts">
import { computed } from 'wevu'
import { useRoute, useRouter } from 'wevu/router'
import {
  ROUTER_COVERAGE_PATHS,
} from '../../../../shared/routerCoverage'

definePageJson({
  navigationBarTitleText: 'router independent target',
})

const route = useRoute()
const router = useRouter()

const routeSummary = computed(() => route.fullPath || `/${route.path}`)

function goHome() {
  return router.push(ROUTER_COVERAGE_PATHS.home)
}

function goMainTarget() {
  return router.push(ROUTER_COVERAGE_PATHS.mainTarget)
}

function goNormalSubpackage() {
  return router.push(ROUTER_COVERAGE_PATHS.normalSubpackageTarget)
}
</script>

<template>
  <view class="router-independent-page">
    <view class="router-independent-page__badge">
      独立分包目标页
    </view>
    <view id="router-target-independent-route" class="router-independent-page__line">
      route = {{ routeSummary }}
    </view>
    <view class="router-independent-page__line">
      这个页面用于验证 wevu/router 到独立分包页的真实跳转。
    </view>

    <view class="router-independent-page__actions">
      <view class="router-independent-page__btn" @tap="goHome">
        返回 coverage 首页
      </view>
      <view class="router-independent-page__btn router-independent-page__btn--secondary" @tap="goMainTarget">
        去主包页
      </view>
      <view class="router-independent-page__btn router-independent-page__btn--accent" @tap="goNormalSubpackage">
        去普通分包页
      </view>
    </view>
  </view>
</template>

<style scoped>
.router-independent-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 28rpx;
  background: linear-gradient(180deg, #ede9fe 0%, #e0e7ff 100%);
}

.router-independent-page__badge {
  display: inline-flex;
  padding: 8rpx 18rpx;
  font-size: 22rpx;
  color: #5b21b6;
  background: #ddd6fe;
  border-radius: 9999rpx;
}

.router-independent-page__line {
  margin-top: 14rpx;
  font-size: 24rpx;
  color: #312e81;
}

.router-independent-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 22rpx;
}

.router-independent-page__btn {
  min-height: 60rpx;
  padding: 0 22rpx;
  font-size: 22rpx;
  line-height: 60rpx;
  color: #fff;
  background: #7c3aed;
  border-radius: 9999rpx;
}

.router-independent-page__btn--secondary {
  background: #b45309;
}

.router-independent-page__btn--accent {
  background: #15803d;
}
</style>
