<script setup lang="ts">
import { ref } from 'wevu'
import { isNavigationFailure, NavigationFailureType, useRouter } from 'wevu/router'

const router = useRouter({
  rejectOnError: false,
  routes: [
    {
      name: 'router-dynamic-home',
      path: '/pages/router-dynamic/index',
    },
    {
      name: 'router-guard-block',
      path: '/router-guard/block',
    },
    {
      name: 'router-guard-error',
      path: '/router-guard/error',
    },
  ],
})

const baseRoutesSummary = ref('pending')
const addRemoveSummary = ref('pending')
const clearSummary = ref('pending')
const optionsSummary = ref('pending')
const guardSummary = ref('pending')
const errorSummary = ref('pending')
const runSummary = ref('idle')

async function runE2E() {
  runSummary.value = 'running'

  const baseRouteNames = router.getRoutes().map(item => item.name)
  baseRoutesSummary.value = baseRouteNames.join(',')

  const removeParent = router.addRoute({
    name: 'router-dynamic-parent',
    path: '/router-dynamic/parent/:id',
    children: [
      {
        name: 'router-dynamic-child',
        path: 'child/:tab',
        alias: 'child-alias/:tab',
      },
    ],
  })

  const addedChild = router.hasRoute('router-dynamic-child')
  const childResolved = router.resolve({
    name: 'router-dynamic-child',
    params: {
      id: 5,
      tab: 'metrics',
    },
    query: {
      from: 'dynamic',
    },
  })

  removeParent()
  const removedChild = !router.hasRoute('router-dynamic-child')

  const removeStandalone = router.addRoute({
    name: 'router-dynamic-standalone',
    path: '/router-dynamic/standalone/:key',
  })
  const standaloneAdded = router.hasRoute('router-dynamic-standalone')
  removeStandalone()
  const standaloneRemoved = !router.hasRoute('router-dynamic-standalone')

  addRemoveSummary.value = `${addedChild ? 'added' : 'missing'}|${childResolved.fullPath}|${removedChild ? 'removed' : 'left'}|${standaloneAdded && standaloneRemoved ? 'stable' : 'unstable'}`

  const beforeClearCount = router.getRoutes().length
  router.clearRoutes()
  const afterClearCount = router.getRoutes().length
  clearSummary.value = `${beforeClearCount}->${afterClearCount}`

  const optionsRouteNames = (router.options.routes ?? []).map(item => item.name).join(',')
  optionsSummary.value = optionsRouteNames

  const offBeforeEach = router.beforeEach((to) => {
    if (to?.path === 'router-guard/block') {
      return false
    }
  })
  const offBeforeResolve = router.beforeResolve((to) => {
    if (to?.path === 'router-guard/error') {
      throw new Error('guard-fail-intentional')
    }
  })

  let afterEachCount = 0
  const offAfterEach = router.afterEach((_to, _from, failure) => {
    if (failure) {
      afterEachCount += 1
    }
  })

  const errorMessages: string[] = []
  const offOnError = router.onError((error) => {
    if (error instanceof Error) {
      errorMessages.push(error.message)
      return
    }
    errorMessages.push(String(error))
  })

  const blockFailure = await router.push('/router-guard/block')
  const errorFailure = await router.push('/router-guard/error')

  offBeforeEach()
  offBeforeResolve()
  offAfterEach()
  offOnError()

  const blockOk = isNavigationFailure(blockFailure, NavigationFailureType.aborted)
  const errorOk = isNavigationFailure(errorFailure, NavigationFailureType.aborted)
  guardSummary.value = `${blockOk ? 'block-ok' : 'block-bad'}|${errorOk ? 'error-ok' : 'error-bad'}|after=${afterEachCount}`
  errorSummary.value = errorMessages.join('|') || 'none'

  const checks = {
    baseRoutesOk: baseRoutesSummary.value.includes('router-dynamic-home'),
    addRemoveOk: addRemoveSummary.value.includes('/router-dynamic/parent/5/child/metrics?from=dynamic')
      && addRemoveSummary.value.includes('added')
      && addRemoveSummary.value.includes('removed')
      && addRemoveSummary.value.includes('stable'),
    clearOk: clearSummary.value.endsWith('->0'),
    optionsOk: optionsSummary.value.includes('router-dynamic-home')
      && !optionsSummary.value.includes('router-dynamic-parent'),
    guardOk: guardSummary.value.includes('block-ok')
      && guardSummary.value.includes('error-ok')
      && guardSummary.value.includes('after=2'),
    errorOk: errorSummary.value.includes('guard-fail-intentional'),
  }

  const ok = Object.values(checks).every(Boolean)
  runSummary.value = ok ? 'ok' : 'fail'

  return {
    ok,
    checks,
    details: {
      baseRoutesSummary: baseRoutesSummary.value,
      addRemoveSummary: addRemoveSummary.value,
      clearSummary: clearSummary.value,
      optionsSummary: optionsSummary.value,
      guardSummary: guardSummary.value,
      errorSummary: errorSummary.value,
      runSummary: runSummary.value,
    },
  }
}

const _runE2E = runE2E
</script>

<template>
  <view class="router-dynamic-page">
    <view class="router-dynamic-page__title">
      wevu/router 能力展示 (dynamic + guards)
    </view>
    <view class="router-dynamic-page__subtitle">
      展示 add/remove/clear、options 快照、beforeEach/beforeResolve/afterEach/onError
    </view>

    <view id="router-dynamic-base" class="router-dynamic-page__line">
      base routes = {{ baseRoutesSummary }}
    </view>
    <view id="router-dynamic-add-remove" class="router-dynamic-page__line">
      add/remove summary = {{ addRemoveSummary }}
    </view>
    <view id="router-dynamic-clear" class="router-dynamic-page__line">
      clear summary = {{ clearSummary }}
    </view>
    <view id="router-dynamic-options" class="router-dynamic-page__line">
      options summary = {{ optionsSummary }}
    </view>
    <view id="router-dynamic-guard" class="router-dynamic-page__line">
      guard summary = {{ guardSummary }}
    </view>
    <view id="router-dynamic-error" class="router-dynamic-page__line">
      error summary = {{ errorSummary }}
    </view>
    <view id="router-dynamic-run" class="router-dynamic-page__line">
      run summary = {{ runSummary }}
    </view>

    <view id="router-dynamic-run-e2e" class="router-dynamic-page__btn" @tap="runE2E">
      run router dynamic e2e
    </view>
  </view>
</template>

<style scoped>
.router-dynamic-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #f8fafc;
}

.router-dynamic-page__title {
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.router-dynamic-page__subtitle {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #475569;
}

.router-dynamic-page__line {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #1e293b;
}

.router-dynamic-page__btn {
  min-height: 60rpx;
  padding: 0 20rpx;
  margin-top: 18rpx;
  font-size: 22rpx;
  line-height: 60rpx;
  color: #fff;
  background: #7c3aed;
  border-radius: 9999rpx;
}
</style>
