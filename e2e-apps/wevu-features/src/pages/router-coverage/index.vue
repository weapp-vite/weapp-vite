<script setup lang="ts">
import { computed, ref } from 'wevu'
import {
  isNavigationFailure,
  NavigationFailureType,
  useRoute,
  useRouter,
} from 'wevu/router'
import {
  ROUTER_COVERAGE_PATHS,
  ROUTER_COVERAGE_TARGETS,
} from '../../shared/routerCoverage'

definePageJson({
  navigationBarTitleText: 'router coverage',
})

const route = useRoute()
const router = useRouter()
const actionSummary = ref('idle')

const routeSummary = computed(() => {
  return route.fullPath || `/${route.path}`
})

async function navigateTo(path: string, mode: 'push' | 'replace' = 'push') {
  console.log('[router-coverage-page] navigate', {
    mode,
    path,
  })

  actionSummary.value = `${mode}:${path}`

  if (mode === 'replace') {
    await router.replace(path)
    return
  }

  await router.push(path)
}

async function triggerBlockedGuard() {
  const failure = await router.push(ROUTER_COVERAGE_PATHS.blocked)
  actionSummary.value = isNavigationFailure(failure, NavigationFailureType.aborted)
    ? 'blocked:aborted'
    : 'blocked:unexpected'
}

async function triggerResolveError() {
  const failure = await router.push(ROUTER_COVERAGE_PATHS.error)
  actionSummary.value = isNavigationFailure(failure, NavigationFailureType.aborted)
    ? 'error:aborted'
    : 'error:unexpected'
}

async function triggerBack() {
  const result = await router.back()
  actionSummary.value = result === undefined ? 'back:ok' : `back:${result.type}`
}
</script>

<template>
  <view class="router-coverage-page">
    <view class="router-coverage-page__title">
      wevu/router 页面跳转覆盖
    </view>
    <view class="router-coverage-page__subtitle">
      覆盖主包、普通分包、独立分包跳转，以及 beforeEach / beforeEnter / beforeResolve / afterEach / onError
    </view>

    <view class="router-coverage-page__panel">
      <view id="router-coverage-route" class="router-coverage-page__line">
        current route = {{ routeSummary }}
      </view>
      <view id="router-coverage-action" class="router-coverage-page__line">
        last action = {{ actionSummary }}
      </view>
    </view>

    <view class="router-coverage-page__section-title">
      页面跳转
    </view>
    <view
      v-for="item in ROUTER_COVERAGE_TARGETS"
      :key="item.key"
      class="router-coverage-page__card"
    >
      <view class="router-coverage-page__card-title">
        {{ item.title }}
      </view>
      <view class="router-coverage-page__card-summary">
        {{ item.summary }}
      </view>
      <view class="router-coverage-page__actions">
        <view class="router-coverage-page__btn" @tap="navigateTo(item.path)">
          push 到当前页
        </view>
        <view
          v-if="item.key === 'independent'"
          class="router-coverage-page__btn router-coverage-page__btn--secondary"
          @tap="navigateTo(item.path, 'replace')"
        >
          replace 到当前页
        </view>
      </view>
    </view>

    <view class="router-coverage-page__section-title">
      守卫触发
    </view>
    <view class="router-coverage-page__actions">
      <view id="router-coverage-blocked" class="router-coverage-page__btn" @tap="triggerBlockedGuard">
        触发 beforeEach 阻断
      </view>
      <view
        id="router-coverage-error"
        class="router-coverage-page__btn router-coverage-page__btn--warn"
        @tap="triggerResolveError"
      >
        触发 beforeResolve 报错
      </view>
      <view
        id="router-coverage-back"
        class="router-coverage-page__btn router-coverage-page__btn--secondary"
        @tap="triggerBack"
      >
        调用 router.back()
      </view>
    </view>
  </view>
</template>

<style scoped>
.router-coverage-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 28rpx;
  background: linear-gradient(180deg, #f8fafc 0%, #eff6ff 48%, #ecfeff 100%);
}

.router-coverage-page__title {
  font-size: 34rpx;
  font-weight: 700;
  color: #0f172a;
}

.router-coverage-page__subtitle {
  margin-top: 10rpx;
  font-size: 23rpx;
  color: #475569;
}

.router-coverage-page__panel {
  padding: 20rpx;
  margin-top: 20rpx;
  background: rgb(255 255 255 / 88%);
  border: 2rpx solid #bfdbfe;
  border-radius: 20rpx;
}

.router-coverage-page__line {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #1e293b;
}

.router-coverage-page__line:first-child {
  margin-top: 0;
}

.router-coverage-page__section-title {
  margin-top: 26rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: #0f172a;
}

.router-coverage-page__card {
  padding: 22rpx;
  margin-top: 14rpx;
  background: rgb(255 255 255 / 92%);
  border: 2rpx solid #cbd5e1;
  border-radius: 22rpx;
}

.router-coverage-page__card-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #0f172a;
}

.router-coverage-page__card-summary {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #64748b;
}

.router-coverage-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 16rpx;
}

.router-coverage-page__btn {
  min-height: 60rpx;
  padding: 0 22rpx;
  font-size: 22rpx;
  line-height: 60rpx;
  color: #fff;
  background: #0f766e;
  border-radius: 9999rpx;
}

.router-coverage-page__btn--secondary {
  background: #2563eb;
}

.router-coverage-page__btn--warn {
  background: #b45309;
}
</style>
