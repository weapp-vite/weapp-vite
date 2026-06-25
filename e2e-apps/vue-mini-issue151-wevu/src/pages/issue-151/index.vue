<script setup lang="ts">
import { getCurrentInstance, onReady, ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'vue-mini-151',
})

const readyCount = ref(0)
const pageInstanceHasOwnOnReady = ref(false)
const pageInstanceOnReadyType = ref('missing')
const wevuHooksBucketType = ref('missing')
const tabBarReady = ref(false)
const tabBarHooksType = ref('missing')

const pageInstance = getCurrentInstance() as Record<string, any> | undefined

function readIssue151RuntimeState() {
  const hooksBucket = pageInstance?.__wevuHooks as Record<string, unknown> | undefined
  const tabBarRuntime = typeof pageInstance?.getTabBar === 'function'
    ? pageInstance.getTabBar()?._runE2E?.()
    : undefined
  return {
    readyCount: readyCount.value,
    pageInstanceHasOwnOnReady: pageInstance
      ? Object.prototype.hasOwnProperty.call(pageInstance, '__onReady__')
      : false,
    pageInstanceOnReadyType: typeof pageInstance?.__onReady__,
    wevuHooksBucketType: Array.isArray(hooksBucket?.onReady)
      ? 'array'
      : typeof hooksBucket?.onReady,
    tabBarReady: Boolean(tabBarRuntime?.ready),
    tabBarHooksType: typeof tabBarRuntime?.wevuHooksType === 'string'
      ? tabBarRuntime.wevuHooksType
      : 'missing',
  }
}

onReady(() => {
  readyCount.value += 1
  const state = readIssue151RuntimeState()
  pageInstanceHasOwnOnReady.value = state.pageInstanceHasOwnOnReady
  pageInstanceOnReadyType.value = state.pageInstanceOnReadyType
  wevuHooksBucketType.value = state.wevuHooksBucketType
  tabBarReady.value = state.tabBarReady
  tabBarHooksType.value = state.tabBarHooksType
})

function _runE2E() {
  const state = readIssue151RuntimeState()
  return {
    ok: state.readyCount > 0
      && state.wevuHooksBucketType === 'array'
      && state.tabBarReady
      && state.tabBarHooksType === 'array',
    issue: 151,
    ...state,
  }
}
</script>

<template>
  <view class="issue151-page">
    <view class="issue151-title">
      vue-mini issue-151 onReady collision probe
    </view>
    <view
      class="issue151-probe"
      :data-ready-count="readyCount"
      :data-has-own-on-ready="pageInstanceHasOwnOnReady ? 'yes' : 'no'"
      :data-on-ready-type="pageInstanceOnReadyType"
      :data-wevu-hooks-type="wevuHooksBucketType"
    >
      ready count: {{ readyCount }}
    </view>
  </view>
</template>

<style scoped>
.issue151-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 32rpx;
  background: #f8fafc;
}

.issue151-title {
  margin-bottom: 24rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue151-probe {
  display: block;
  padding: 16rpx;
  font-size: 24rpx;
  color: #111827;
  background: #e2e8f0;
}
</style>
