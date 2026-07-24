<script setup lang="ts">
import { computed } from 'wevu'
import { useRoute, useRouter } from 'wevu/router'

definePageJson({
  navigationBarTitleText: 'issue-550',
})

const route = useRoute()
const router = useRouter()
const routeName = computed(() => route.name ?? '')
const routeMatchedName = computed(() => route.matched?.[0]?.name ?? '')
const BACK_RESULT_STORAGE_KEY = '__weapp_vite_issue_705_back_result__'

function prepareBackProbe() {
  wx.setStorageSync(BACK_RESULT_STORAGE_KEY, {
    stage: 'started',
  })
}

function routerBack() {
  prepareBackProbe()
  return router.back()
}

function nativeBack() {
  prepareBackProbe()
  return wx.navigateBack()
}

function _runE2E(action?: 'nativeBack' | 'prepareBack' | 'routerBack') {
  if (action === 'routerBack') {
    return routerBack()
  }
  if (action === 'nativeBack') {
    return nativeBack()
  }
  if (action === 'prepareBack') {
    prepareBackProbe()
    return
  }
  return {
    ok: route.name === 'pages/issue-550/index',
    name: route.name,
    matchedName: route.matched?.[0]?.name,
  }
}
</script>

<template>
  <view class="issue550-page">
    <text class="issue550-title">
      issue-550 useRoute name
    </text>
    <view
      class="issue550-probe"
      :data-route-name="routeName"
      :data-matched-name="routeMatchedName"
    >
      route name = {{ routeName }}
    </view>
    <button @tap="routerBack">
      router back
    </button>
    <button @tap="nativeBack">
      native back
    </button>
  </view>
</template>

<style scoped>
.issue550-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #fff;
}

.issue550-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.issue550-probe {
  padding: 16rpx;
  margin-top: 18rpx;
  font-size: 24rpx;
  color: #111827;
  background: #e5e7eb;
  border-radius: 8rpx;
}
</style>
