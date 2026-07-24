<script setup lang="ts">
import { computed, onReady, onUnload } from 'wevu'
import { useRoute, useRouter } from 'wevu/router'

definePageJson({
  navigationBarTitleText: 'issue-705',
})

const route = useRoute()
const router = useRouter()
const routePath = computed(() => route.path)
const hookCalls: Array<{ phase: string, to?: string, from: string }> = []
const backHookCalls: Array<{ phase: string, to?: string, from: string }> = []
const BACK_RESULT_STORAGE_KEY = '__weapp_vite_issue_705_back_result__'
const PUSH_RESULT_STORAGE_KEY = '__weapp_vite_issue_705_push_result__'
const SWITCH_TAB_RESULT_STORAGE_KEY = '__weapp_vite_issue_705_switch_tab_result__'
let lastFailure: null | { cause: string, type: number } = null
let ready = false

function createSnapshot() {
  return {
    route: {
      path: route.path,
      fullPath: route.fullPath,
      name: route.name,
    },
    routerRoute: {
      path: router.currentRoute.path,
      fullPath: router.currentRoute.fullPath,
      name: router.currentRoute.name,
    },
    hooks: hookCalls.slice(),
    failure: lastFailure,
    ready,
  }
}

function recordBackHook(call: { phase: string, to?: string, from: string }) {
  const backProbe = wx.getStorageSync(BACK_RESULT_STORAGE_KEY)
  if (backProbe?.stage !== 'started' && backHookCalls.length === 0) {
    return
  }
  if (backProbe?.stage === 'started') {
    backHookCalls.length = 0
  }
  backHookCalls.push(call)
  wx.setStorageSync(BACK_RESULT_STORAGE_KEY, {
    hooks: backHookCalls.slice(),
    route: {
      fullPath: route.fullPath,
      path: route.path,
    },
  })
}

const removeBeforeEach = router.beforeEach((to, from) => {
  const call = {
    phase: 'before',
    to: to?.path,
    from: from.path,
  }
  hookCalls.push(call)
  recordBackHook(call)
  wx.setStorageSync(PUSH_RESULT_STORAGE_KEY, {
    from: from.path,
    stage: 'before',
    to: to?.path,
  })
})

const removeAfterEach = router.afterEach((to, from, failure) => {
  const call = {
    phase: 'after',
    to: to?.path,
    from: from.path,
  }
  hookCalls.push(call)
  recordBackHook(call)
  lastFailure = failure
    ? {
        cause: String((failure.cause as any)?.errMsg ?? failure.cause ?? ''),
        type: failure.type,
      }
    : null
  wx.setStorageSync(PUSH_RESULT_STORAGE_KEY, createSnapshot())
})

onUnload(() => {
  removeBeforeEach()
  removeAfterEach()
})

onReady(() => {
  ready = true
})

async function pushToTarget() {
  hookCalls.length = 0
  lastFailure = null
  wx.setStorageSync(PUSH_RESULT_STORAGE_KEY, {
    stage: 'started',
  })
  await router.push('/pages/issue-550/index')
  return createSnapshot()
}

async function _runE2E(action?: 'push' | 'switchTab') {
  if (action === 'push') {
    return pushToTarget()
  }

  if (action === 'switchTab') {
    await new Promise<void>((resolve, reject) => {
      wx.switchTab({
        url: '/pages/issue-705-tab/index',
        success() {
          wx.setStorageSync(SWITCH_TAB_RESULT_STORAGE_KEY, createSnapshot())
          resolve()
        },
        fail: reject,
      })
    })
  }

  return createSnapshot()
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <view
    class="issue705-page"
    :data-route-path="routePath"
  >
    <text class="issue705-title">
      issue-705 router route sync
    </text>
    <button
      class="issue705-push"
      @tap="pushToTarget"
    >
      push target
    </button>
  </view>
</template>

<style scoped>
.issue705-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #fff;
}

.issue705-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.issue705-push {
  margin-top: 24rpx;
}
</style>
