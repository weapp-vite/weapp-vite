<script setup lang="ts">
import { computed } from 'wevu'
import { useRoute, useRouter } from 'wevu/router'

definePageJson({
  navigationBarTitleText: 'Guide',
})

const HOME_PATH = '/pages/index/index'
const PACKAGE_A_DEMO_PATH = '/packageA/pages/demo/index'
const PACKAGE_B_ENTRY_PATH = '/packageB/pages/entry/index'

const route = useRoute()
const router = useRouter()

const summary = computed(() => {
  return route.fullPath || `/${route.path}`
})

async function toIndependentEntry() {
  await router.push(PACKAGE_B_ENTRY_PATH)
}

async function backHome() {
  await router.push(HOME_PATH)
}
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="card__title">
        主包页面
      </view>
      <view class="card__summary">
        当前路由：{{ summary }}
      </view>
      <RouteFeature
        title="守卫触发"
        description="从主包继续跳转到普通分包和独立分包，开发者工具控制台会输出全局守卫日志。"
      />
    </view>

    <button class="action-btn" @tap="router.push(PACKAGE_A_DEMO_PATH)">
      跳到普通分包 demo
    </button>
    <button class="action-btn action-btn--secondary" @tap="toIndependentEntry">
      跳到独立分包 entry
    </button>
    <button class="action-btn action-btn--ghost" @tap="backHome">
      返回首页
    </button>
  </view>
</template>

<style>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 30rpx;
  background: linear-gradient(180deg, #f8fffc 0%, #effcf6 100%);
}

.card {
  padding: 28rpx;
  background: #fff;
  border: 2rpx solid #a7f3d0;
  border-radius: 28rpx;
}

.card__title {
  font-size: 38rpx;
  font-weight: 700;
  color: #134e4a;
}

.card__summary,
.card__desc {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #335c58;
}

.action-btn {
  margin-top: 18rpx;
  color: #fff;
  background: linear-gradient(135deg, #0f766e, #0d9488);
  border-radius: 999rpx;
}

.action-btn--secondary {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
}

.action-btn--ghost {
  color: #0f766e;
  background: #ccfbf1;
}
</style>
