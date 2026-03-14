<script setup lang="ts">
import { computed } from 'wevu'
import { useRoute, useRouter } from 'wevu/router'

definePageJson({
  navigationBarTitleText: 'Router Home',
})

const HOME_PATH = '/pages/index/index'
const GUIDE_PATH = '/pages/guide/index'
const PACKAGE_A_DEMO_PATH = '/packageA/pages/demo/index'
const PACKAGE_B_ENTRY_PATH = '/packageB/pages/entry/index'

const route = useRoute()
const router = useRouter()
const routeSummary = computed(() => route.fullPath || `/${route.path}`)

async function pushTo(path: string) {
  await router.push(path)
}

async function relaunchToHome() {
  await router.nativeRouter.reLaunch({
    url: HOME_PATH,
  })
}
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="card__title">
        wevu/router + auto-routes
      </view>
      <RouteFeature
        title="最小演示"
        description="router 直接在 app.vue 中创建，页面和分包路由都来自 auto-routes。"
      />
      <view class="card__route">
        当前路由：{{ routeSummary }}
      </view>
    </view>

    <RouteBadge label="src/components 内组件通过自动导入直接可用" tone="info" />

    <button class="action-btn" @tap="pushTo(GUIDE_PATH)">
      跳到主包 guide
    </button>
    <button class="action-btn action-btn--secondary" @tap="pushTo(PACKAGE_A_DEMO_PATH)">
      跳到普通分包
    </button>
    <button class="action-btn action-btn--ghost" @tap="pushTo(PACKAGE_B_ENTRY_PATH)">
      跳到独立分包
    </button>
    <button class="action-btn action-btn--light" @tap="relaunchToHome">
      reLaunch 当前首页
    </button>
  </view>
</template>

<style>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 28rpx;
  background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
}

.card {
  padding: 28rpx;
  background: #fff;
  border: 2rpx solid #dbeafe;
  border-radius: 24rpx;
}

.card__title {
  font-size: 36rpx;
  font-weight: 700;
  color: #0f172a;
}

.card__desc,
.card__route {
  margin-top: 14rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #334155;
}

.action-btn {
  margin-top: 18rpx;
  color: #fff;
  background: #2563eb;
  border-radius: 999rpx;
}

.action-btn--secondary {
  background: #0f766e;
}

.action-btn--ghost {
  background: #7c3aed;
}

.action-btn--light {
  color: #1d4ed8;
  background: #dbeafe;
}
</style>
