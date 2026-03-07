<script setup lang="ts">
import { ref } from 'wevu'
import { useRouter } from 'wevu/router'

definePageJson({
  navigationBarTitleText: 'issue-320',
  backgroundColor: '#ffffff',
})

const router = useRouter({
  routes: [
    {
      name: 'issue320-home',
      path: '/pages/issue-320/index',
    },
    {
      name: 'issue320-legacy',
      path: '/pages/issue-320/legacy',
      alias: '/pages/issue-320/legacy-alias',
      redirect: '/pages/issue-320/index?from=legacy',
    },
  ],
})

const report = ref({
  ok: false,
  beforePath: '',
  overriddenPath: '',
  newAliasName: '',
  oldAliasName: '',
  matchedAliasPath: '',
  redirect: '',
  alias: '',
  hasLegacyRoute: false,
})

function _runE2E() {
  const beforeRoute = router.resolve({
    name: 'issue320-legacy',
  })

  router.addRoute({
    name: 'issue320-legacy',
    path: '/pages/issue-320/new',
    alias: '/pages/issue-320/new-alias',
    redirect: '/pages/issue-320/index?from=override',
  })

  const overriddenRoute = router.resolve({
    name: 'issue320-legacy',
  })
  const resolvedByNewAlias = router.resolve('/pages/issue-320/new-alias')
  const resolvedByOldAlias = router.resolve('/pages/issue-320/legacy-alias')
  const currentRecord = router.getRoutes().find(route => route.name === 'issue320-legacy')
  const currentAlias = typeof currentRecord?.alias === 'string'
    ? currentRecord.alias
    : ''
  const currentRedirect = typeof currentRecord?.redirect === 'string'
    ? currentRecord.redirect
    : ''

  const nextReport = {
    ok: beforeRoute.path === '/pages/issue-320/legacy'
      && overriddenRoute.path === '/pages/issue-320/new'
      && resolvedByNewAlias.name === 'issue320-legacy'
      && resolvedByOldAlias.name === undefined
      && (resolvedByNewAlias.matched?.[0]?.aliasPath ?? '') === '/pages/issue-320/new-alias'
      && currentAlias === '/pages/issue-320/new-alias'
      && currentRedirect === '/pages/issue-320/index?from=override'
      && router.hasRoute('issue320-legacy'),
    beforePath: beforeRoute.path,
    overriddenPath: overriddenRoute.path,
    newAliasName: resolvedByNewAlias.name ?? '',
    oldAliasName: resolvedByOldAlias.name ?? '',
    matchedAliasPath: resolvedByNewAlias.matched?.[0]?.aliasPath ?? '',
    redirect: currentRedirect,
    alias: currentAlias,
    hasLegacyRoute: router.hasRoute('issue320-legacy'),
  }

  report.value = nextReport
  return nextReport
}
</script>

<template>
  <view class="issue320-page">
    <text class="issue320-title">
      issue-320 router override + alias + redirect
    </text>
    <text class="issue320-subtitle">
      验证 addRoute 同名替换后 alias/redirect 配置已切换到新记录
    </text>

    <view
      class="issue320-probe"
      :data-ok="report.ok ? 'yes' : 'no'"
      :data-before-path="report.beforePath"
      :data-overridden-path="report.overriddenPath"
      :data-new-alias-name="report.newAliasName"
      :data-old-alias-name="report.oldAliasName"
      :data-matched-alias-path="report.matchedAliasPath"
      :data-redirect="report.redirect"
      :data-alias="report.alias"
      :data-has-legacy-route="report.hasLegacyRoute ? 'yes' : 'no'"
    >
      ready for runtime e2e
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
</style>
