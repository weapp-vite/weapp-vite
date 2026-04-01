<script setup lang="ts">
function _runE2E() {
  const currentPages = getCurrentPages() as Array<Record<string, any>>
  const currentPage = currentPages.at(-1)
  const tabBar = currentPage?.getTabBar?.()
  const tabBarRuntime = typeof tabBar?._runE2E === 'function'
    ? tabBar._runE2E()
    : {
        ready: tabBar?.data?.ready ?? null,
        layoutWrapperDetected: tabBar?.data?.layoutWrapperDetected ?? null,
      }

  return {
    hasTabBar: Boolean(tabBar),
    tabBarRuntime,
  }
}
</script>

<template>
  <view class="issue-380-page">
    <text>issue-380 page</text>
  </view>
</template>
