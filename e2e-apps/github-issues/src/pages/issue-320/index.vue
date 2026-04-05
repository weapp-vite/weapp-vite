<script setup lang="ts">
import { ref } from 'wevu'
import { useRouter } from 'wevu/router'

definePageJson({
  navigationBarTitleText: 'issue-320',
  backgroundColor: '#ffffff',
})

const router = useRouter()

const report = ref({
  ok: false,
  currentPath: '',
  aliasName: '',
  matchedAliasPath: '',
  redirect: '',
  alias: '',
  hasLegacyRoute: false,
})

const legacyRouteRecord = {
  name: 'issue320-legacy',
  path: '/pages/issue-320/legacy',
  alias: '/pages/issue-320/legacy-alias',
  redirect: '/pages/issue-309/index?from=issue320-legacy',
} as const

function ensureLegacyRoute() {
  if (router.hasRoute(legacyRouteRecord.name)) {
    return
  }

  router.addRoute({
    ...legacyRouteRecord,
  })
}

function _runE2E() {
  ensureLegacyRoute()

  const currentRoute = router.resolve({
    name: 'issue320-legacy',
  })
  const resolvedByAlias = router.resolve('/pages/issue-320/legacy-alias')
  const currentRecord = router.getRoutes().find(route => route.name === 'issue320-legacy')
  const currentAlias = typeof currentRecord?.alias === 'string'
    ? currentRecord.alias
    : ''
  const currentRedirect = typeof currentRecord?.redirect === 'string'
    ? currentRecord.redirect
    : ''

  const nextReport = {
    ok: currentRoute.fullPath === '/pages/issue-320/legacy'
      && resolvedByAlias.name === 'issue320-legacy'
      && (resolvedByAlias.matched?.[0]?.aliasPath ?? '') === '/pages/issue-320/legacy-alias'
      && currentAlias === '/pages/issue-320/legacy-alias'
      && currentRedirect === '/pages/issue-309/index?from=issue320-legacy'
      && router.hasRoute('issue320-legacy'),
    currentPath: currentRoute.fullPath,
    aliasName: resolvedByAlias.name ?? '',
    matchedAliasPath: resolvedByAlias.matched?.[0]?.aliasPath ?? '',
    redirect: currentRedirect,
    alias: currentAlias,
    hasLegacyRoute: router.hasRoute('issue320-legacy'),
  }

  report.value = nextReport
  return nextReport
}

async function runRedirectNavigationE2E() {
  ensureLegacyRoute()
  const result = await router.push({ name: 'issue320-legacy' })
  return {
    ok: result === undefined,
  }
}
</script>

<template>
  <view class="issue320-page">
    <text class="issue320-title">
      issue-320 dynamic route alias + redirect
    </text>
    <text class="issue320-subtitle">
      验证运行时 addRoute 注册的 alias/redirect 配置可用
    </text>

    <view
      class="issue320-probe"
      :data-ok="report.ok ? 'yes' : 'no'"
      :data-current-path="report.currentPath"
      :data-alias-name="report.aliasName"
      :data-matched-alias-path="report.matchedAliasPath"
      :data-redirect="report.redirect"
      :data-alias="report.alias"
      :data-has-legacy-route="report.hasLegacyRoute ? 'yes' : 'no'"
    >
      ready for runtime e2e
    </view>

    <view
      class="issue320-nav-trigger"
      @tap="runRedirectNavigationE2E"
    >
      run redirect navigation e2e
    </view>
  </view>
</template>

<style scoped>
.issue320-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #f8fafc;
}

.issue320-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue320-subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #475569;
}

.issue320-probe {
  display: block;
  padding: 16rpx;
  margin-top: 20rpx;
  font-size: 24rpx;
  color: #0f172a;
  background: #e2e8f0;
  border-radius: 12rpx;
}

.issue320-nav-trigger {
  padding: 12rpx 16rpx;
  margin-top: 14rpx;
  font-size: 24rpx;
  color: #fff;
  background: #0f766e;
  border-radius: 12rpx;
}
</style>
