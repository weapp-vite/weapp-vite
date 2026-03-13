<script setup lang="ts">
import { computed } from 'wevu'
import { useRoute, useRouter } from 'wevu/router'
import {
  ROUTER_COVERAGE_PATHS,
} from '../../../../shared/routerCoverage'

definePageJson({
  navigationBarTitleText: 'router subpackage target',
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

function goIndependentSubpackage() {
  return router.push(ROUTER_COVERAGE_PATHS.independentSubpackageTarget)
}
</script>

<template>
  <view class="router-subpackage-page">
    <view class="router-subpackage-page__badge">
      普通分包目标页
    </view>
    <view id="router-target-subpackage-route" class="router-subpackage-page__line">
      route = {{ routeSummary }}
    </view>
    <view class="router-subpackage-page__line">
      这个页面用于验证 wevu/router 到普通分包页的真实跳转。
    </view>

    <view class="router-subpackage-page__actions">
      <view class="router-subpackage-page__btn" @tap="goHome">
        返回 coverage 首页
      </view>
      <view class="router-subpackage-page__btn router-subpackage-page__btn--secondary" @tap="goMainTarget">
        去主包页
      </view>
      <view class="router-subpackage-page__btn router-subpackage-page__btn--accent" @tap="goIndependentSubpackage">
        去独立分包页
      </view>
    </view>
  </view>
</template>

<style scoped>
.router-subpackage-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 28rpx;
  background: linear-gradient(180deg, #ecfccb 0%, #dcfce7 100%);
}

.router-subpackage-page__badge {
  display: inline-flex;
  padding: 8rpx 18rpx;
  font-size: 22rpx;
  color: #166534;
  background: #bbf7d0;
  border-radius: 9999rpx;
}

.router-subpackage-page__line {
  margin-top: 14rpx;
  font-size: 24rpx;
  color: #14532d;
}

.router-subpackage-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 22rpx;
}

.router-subpackage-page__btn {
  min-height: 60rpx;
  padding: 0 22rpx;
  font-size: 22rpx;
  line-height: 60rpx;
  color: #fff;
  background: #15803d;
  border-radius: 9999rpx;
}

.router-subpackage-page__btn--secondary {
  background: #b45309;
}

.router-subpackage-page__btn--accent {
  background: #2563eb;
}
</style>
