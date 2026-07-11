<script setup lang="ts">
import { computed, onReady, onUnload } from 'wevu'
import { useRoute, useRouter } from 'wevu/router'

definePageJson({
  navigationBarTitleText: 'issue-705-tab',
})

const route = useRoute()
const router = useRouter()
const routePath = computed(() => route.path)
const hookCalls: Array<{ phase: string, to?: string, from: string }> = []
const TAB_PUSH_RESULT_STORAGE_KEY = '__weapp_vite_issue_705_tab_push_result__'
let lastFailure: null | { cause: string, type: number } = null
let ready = false

function createSnapshot() {
  return {
    route: {
      path: route.path,
      fullPath: route.fullPath,
      name: route.name,
    },
    hooks: hookCalls.slice(),
    failure: lastFailure,
    ready,
  }
}

const removeBeforeEach = router.beforeEach((to, from) => {
  hookCalls.push({
    phase: 'before',
    to: to?.path,
    from: from.path,
  })
  wx.setStorageSync(TAB_PUSH_RESULT_STORAGE_KEY, {
    from: from.path,
    stage: 'before',
    to: to?.path,
  })
})

const removeAfterEach = router.afterEach((to, from, failure) => {
  hookCalls.push({
    phase: 'after',
    to: to?.path,
    from: from.path,
  })
  lastFailure = failure
    ? {
        cause: String((failure.cause as any)?.errMsg ?? failure.cause ?? ''),
        type: failure.type,
      }
    : null
  wx.setStorageSync(TAB_PUSH_RESULT_STORAGE_KEY, createSnapshot())
})

onUnload(() => {
  removeBeforeEach()
  removeAfterEach()
})

onReady(() => {
  ready = true
})

async function _runE2E(action?: 'push') {
  if (action !== 'push') {
    return createSnapshot()
  }
  hookCalls.length = 0
  lastFailure = null
  wx.setStorageSync(TAB_PUSH_RESULT_STORAGE_KEY, {
    stage: 'started',
  })
  await router.push('/pages/issue-550/index')
  return createSnapshot()
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <view
    class="issue705-tab-page"
    :data-route-path="routePath"
  >
    <text class="issue705-tab-title">
      issue-705 native switchTab target
    </text>
  </view>
</template>

<style scoped>
.issue705-tab-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #fff;
}

.issue705-tab-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}
</style>
