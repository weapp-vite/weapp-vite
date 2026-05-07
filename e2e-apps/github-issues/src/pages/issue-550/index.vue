<script setup lang="ts">
import { computed } from 'wevu'
import { useRoute } from 'wevu/router'

definePageJson({
  navigationBarTitleText: 'issue-550',
})

const route = useRoute()
const routeName = computed(() => route.name ?? '')
const routeMatchedName = computed(() => route.matched?.[0]?.name ?? '')

function _runE2E() {
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
