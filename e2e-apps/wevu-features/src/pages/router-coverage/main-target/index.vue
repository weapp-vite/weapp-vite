<script setup lang="ts">
import { computed } from 'wevu'
import { useRoute, useRouter } from 'wevu/router'
import {
  ROUTER_COVERAGE_PATHS,
} from '../../../shared/routerCoverage'

definePageJson({
  navigationBarTitleText: 'router main target',
})

const route = useRoute()
const router = useRouter()

const routeSummary = computed(() => route.fullPath || `/${route.path}`)

function goHome() {
  return router.push(ROUTER_COVERAGE_PATHS.home)
}

function goNormalSubpackage() {
  return router.push(ROUTER_COVERAGE_PATHS.normalSubpackageTarget)
}

function goIndependentSubpackage() {
  return router.push(ROUTER_COVERAGE_PATHS.independentSubpackageTarget)
}
</script>

<template>
  <view class="router-target-page">
    <view class="router-target-page__badge">
      主包目标页
    </view>
    <view id="router-target-main-route" class="router-target-page__line">
      route = {{ routeSummary }}
    </view>
    <view class="router-target-page__line">
      这个页面用于验证 wevu/router 到主包页的真实跳转。
    </view>

    <view class="router-target-page__actions">
      <view class="router-target-page__btn" @tap="goHome">
        返回 coverage 首页
      </view>
      <view class="router-target-page__btn router-target-page__btn--secondary" @tap="goNormalSubpackage">
        去普通分包页
      </view>
      <view class="router-target-page__btn router-target-page__btn--accent" @tap="goIndependentSubpackage">
        去独立分包页
      </view>
    </view>
  </view>
</template>

<style scoped>
.router-target-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 28rpx;
  background: linear-gradient(180deg, #fefce8 0%, #fff7ed 100%);
}

.router-target-page__badge {
  display: inline-flex;
  padding: 8rpx 18rpx;
  font-size: 22rpx;
  color: #92400e;
  background: #fde68a;
  border-radius: 9999rpx;
}

.router-target-page__line {
  margin-top: 14rpx;
  font-size: 24rpx;
  color: #422006;
}

.router-target-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 22rpx;
}

.router-target-page__btn {
  min-height: 60rpx;
  padding: 0 22rpx;
  font-size: 22rpx;
  line-height: 60rpx;
  color: #fff;
  background: #b45309;
  border-radius: 9999rpx;
}

.router-target-page__btn--secondary {
  background: #0f766e;
}

.router-target-page__btn--accent {
  background: #2563eb;
}
</style>
