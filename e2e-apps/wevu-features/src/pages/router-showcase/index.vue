<script setup lang="ts">
import { computed, ref } from 'wevu'
import {
  isNavigationFailure,
  NavigationFailureType,
  parseQuery,
  resolveRouteLocation,
  stringifyQuery,
  useRoute,
  useRouter,
} from 'wevu/router'

const route = useRoute()
const router = useRouter()

const parseSummary = ref('pending')
const stringifySummary = ref('pending')
const namedRouteSummary = ref('pending')
const aliasSummary = ref('pending')
const relativeSummary = ref('pending')
const hashOnlySummary = ref('pending')
const forwardSummary = ref('pending')
const goSummary = ref('pending')
const readySummary = ref('pending')
const runSummary = ref('idle')

const routeSummary = computed(() => {
  const currentPath = route.path ? `/${route.path}` : '/'
  return `${currentPath}|${route.fullPath}`
})

async function runE2E() {
  runSummary.value = 'running'

  const parsed = parseQuery('?tag=alpha&tag=beta&flag&count=2')
  parseSummary.value = JSON.stringify(parsed)

  stringifySummary.value = stringifyQuery({
    tag: ['alpha', 'beta'],
    flag: null,
    count: 2,
  })

  const namedResolved = router.resolve('/pages/router-showcase/profile/12/detail/logs?from=named')
  namedRouteSummary.value = `${namedResolved.fullPath}|${namedResolved.matched?.length ?? 0}`

  const aliasResolved = router.resolve('/router-profile/9/detail-alias/trace')
  const aliasLeaf = aliasResolved.matched.at(-1)
  aliasSummary.value = `${aliasResolved.fullPath}|${aliasLeaf?.aliasPath ?? 'none'}`

  const relativeResolved = resolveRouteLocation('./profile/3/detail/metrics?from=relative', 'pages/router-showcase/index')
  relativeSummary.value = relativeResolved.fullPath

  const currentPath = route.path ? `/${route.path}` : '/'
  const currentQuery = stringifyQuery(route.query)
  const hashOnlyTarget = `${currentPath}${currentQuery ? `?${currentQuery}` : ''}#hash-only`
  const hashOnlyFailure = await router.push(hashOnlyTarget)
  hashOnlySummary.value = isNavigationFailure(hashOnlyFailure, NavigationFailureType.aborted) ? 'aborted' : 'unexpected'

  const forwardFailure = await router.forward()
  forwardSummary.value = isNavigationFailure(forwardFailure, NavigationFailureType.aborted) ? 'aborted' : 'unexpected'

  const goResult = await router.go(0)
  goSummary.value = goResult === undefined ? 'noop' : 'unexpected'

  await router.isReady()
  readySummary.value = 'ready'

  const checks = {
    parseOk: parseSummary.value.includes('"tag":["alpha","beta"]') && parseSummary.value.includes('"flag":null'),
    stringifyOk: stringifySummary.value.includes('tag=alpha') && stringifySummary.value.includes('count=2'),
    namedOk: namedRouteSummary.value.includes('/pages/router-showcase/profile/12/detail/logs?from=named'),
    aliasOk: aliasSummary.value.includes('/router-profile/9/detail-alias/trace') && aliasSummary.value.includes('detail-alias'),
    relativeOk: relativeSummary.value === '/pages/router-showcase/profile/3/detail/metrics?from=relative',
    hashOnlyOk: hashOnlySummary.value === 'aborted',
    forwardOk: forwardSummary.value === 'aborted',
    goOk: goSummary.value === 'noop',
    readyOk: readySummary.value === 'ready',
  }

  const ok = Object.values(checks).every(Boolean)
  runSummary.value = ok ? 'ok' : 'fail'

  return {
    ok,
    checks,
    details: {
      routeSummary: routeSummary.value,
      parseSummary: parseSummary.value,
      stringifySummary: stringifySummary.value,
      namedRouteSummary: namedRouteSummary.value,
      aliasSummary: aliasSummary.value,
      relativeSummary: relativeSummary.value,
      hashOnlySummary: hashOnlySummary.value,
      forwardSummary: forwardSummary.value,
      goSummary: goSummary.value,
      readySummary: readySummary.value,
      runSummary: runSummary.value,
    },
  }
}

const _runE2E = runE2E
</script>

<template>
  <view class="router-showcase-page">
    <view class="router-showcase-page__title">
      wevu/router 能力展示 (showcase)
    </view>
    <view class="router-showcase-page__subtitle">
      展示 query 编解码、命名路由、alias、hash-only 失败、forward/go/isReady
    </view>

    <view id="router-showcase-route" class="router-showcase-page__line">
      route summary = {{ routeSummary }}
    </view>
    <view id="router-showcase-parse" class="router-showcase-page__line">
      parse summary = {{ parseSummary }}
    </view>
    <view id="router-showcase-stringify" class="router-showcase-page__line">
      stringify summary = {{ stringifySummary }}
    </view>
    <view id="router-showcase-named" class="router-showcase-page__line">
      named summary = {{ namedRouteSummary }}
    </view>
    <view id="router-showcase-alias" class="router-showcase-page__line">
      alias summary = {{ aliasSummary }}
    </view>
    <view id="router-showcase-relative" class="router-showcase-page__line">
      relative summary = {{ relativeSummary }}
    </view>
    <view id="router-showcase-hash-only" class="router-showcase-page__line">
      hash-only summary = {{ hashOnlySummary }}
    </view>
    <view id="router-showcase-forward" class="router-showcase-page__line">
      forward summary = {{ forwardSummary }}
    </view>
    <view id="router-showcase-go" class="router-showcase-page__line">
      go summary = {{ goSummary }}
    </view>
    <view id="router-showcase-ready" class="router-showcase-page__line">
      ready summary = {{ readySummary }}
    </view>
    <view id="router-showcase-run" class="router-showcase-page__line">
      run summary = {{ runSummary }}
    </view>

    <view id="router-showcase-run-e2e" class="router-showcase-page__btn" @tap="runE2E">
      run router showcase e2e
    </view>
  </view>
</template>

<style scoped>
.router-showcase-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #f8fafc;
}

.router-showcase-page__title {
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.router-showcase-page__subtitle {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #475569;
}

.router-showcase-page__line {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #1e293b;
}

.router-showcase-page__btn {
  min-height: 60rpx;
  padding: 0 20rpx;
  margin-top: 18rpx;
  font-size: 22rpx;
  line-height: 60rpx;
  color: #fff;
  background: #1d4ed8;
  border-radius: 9999rpx;
}
</style>
