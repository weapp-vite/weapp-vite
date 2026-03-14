<script setup lang="ts">
import { computed } from 'wevu'
import { useRoute, useRouter } from 'wevu/router'

definePageJson({
  navigationBarTitleText: 'PackageB Entry',
})

const HOME_PATH = '/pages/index/index'
const GUIDE_PATH = '/pages/guide/index'

const route = useRoute()
const router = useRouter()

const routeSummary = computed(() => route.fullPath || `/${route.path}`)

async function relaunchHome() {
  await router.nativeRouter.reLaunch({
    url: HOME_PATH,
  })
}
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="card__eyebrow">
        独立分包
      </view>
      <view class="card__title">
        packageB / entry
      </view>
      <view class="card__summary">
        当前路由：{{ routeSummary }}
      </view>
      <RouteFeature
        title="独立分包"
        description="独立分包页面同样直接使用 useRouter()，并复用 app.vue 中注册的同一个 router。"
      />
    </view>

    <button class="action-btn" @tap="router.push(GUIDE_PATH)">
      跳回主包 guide
    </button>
    <button class="action-btn action-btn--ghost" @tap="relaunchHome">
      reLaunch 回主包首页
    </button>
  </view>
</template>

<style>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 34rpx 30rpx;
  background: linear-gradient(180deg, #fcfaff 0%, #f7f0ff 100%);
}

.card {
  padding: 28rpx;
  background: #fff;
  border: 2rpx solid rgb(196 181 253 / 35%);
  border-radius: 28rpx;
}

.card__eyebrow {
  font-size: 22rpx;
  font-weight: 700;
  color: #7c3aed;
}

.card__title {
  margin-top: 10rpx;
  font-size: 38rpx;
  font-weight: 700;
  color: #581c87;
}

.card__summary,
.card__desc {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #4c1d95;
}

.action-btn {
  margin-top: 18rpx;
  color: #fff;
  background: linear-gradient(135deg, #7c3aed, #6d28d9);
  border-radius: 999rpx;
}

.action-btn--ghost {
  color: #6d28d9;
  background: #ede9fe;
}
</style>
