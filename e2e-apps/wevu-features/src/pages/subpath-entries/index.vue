<script setup lang="ts">
import { computed, nextTick, ref } from 'wevu'
import { createWeapi, wpi } from 'wevu/api'
import { fetch as wevuFetch } from 'wevu/fetch'
import { useRouter } from 'wevu/router'
import { createStore, defineStore, storeToRefs } from 'wevu/store'

createStore().use(({ store }) => {
  ;(store as any).__subpathPluginTouched = true
})

const useSubpathScenarioStore = defineStore('featureSubpathEntriesStore', () => {
  const count = ref(0)
  const label = ref('init')

  function bump() {
    count.value += 1
  }

  function rename(next: string) {
    label.value = next
  }

  function reset() {
    count.value = 0
    label.value = 'init'
  }

  return {
    count,
    label,
    bump,
    rename,
    reset,
  }
})

const scenarioStore = useSubpathScenarioStore()
const scenarioRefs = storeToRefs(scenarioStore)
const scenarioCount = computed(() => scenarioRefs.count.value)
const scenarioLabel = computed(() => scenarioRefs.label.value)

const router = useRouter({
  routes: [
    {
      name: 'subpath-entries',
      path: '/pages/subpath-entries/index',
    },
    {
      name: 'router-target',
      path: '/pages/router-stability/target/index',
    },
  ],
})

const routerFullPath = ref('pending')
const apiStatus = ref('pending')
const fetchStatus = ref('pending')
const fetchPayload = ref('pending')
const requestCount = ref(0)
const requestDataEcho = ref('')
const runSummary = ref('idle')

function createMockRequestAdapter() {
  return {
    request(options: any) {
      requestCount.value += 1
      requestDataEcho.value = String(options?.data ?? '')
      options?.success?.({
        data: '{"ok":true,"source":"subpath-adapter"}',
        statusCode: 200,
        header: {
          'content-type': 'application/json',
          'x-subpath-source': 'adapter',
        },
      })
      return {
        abort() {},
      }
    },
  }
}

async function runE2E() {
  scenarioStore.reset()
  requestCount.value = 0
  requestDataEcho.value = ''
  runSummary.value = 'running'

  scenarioStore.bump()
  scenarioStore.rename('subpath-ready')

  const resolvedRoute = router.resolve({
    name: 'router-target',
    query: {
      from: 'subpath-entry',
      step: scenarioRefs.count.value,
    },
  })
  routerFullPath.value = resolvedRoute.fullPath

  const adapter = createMockRequestAdapter()
  const localApi = createWeapi({
    adapter: adapter as any,
    platform: 'wx',
  })
  const localApiResolved = localApi.resolveTarget('request')
  const localApiSupportsRequest = localApi.supports('request')
  apiStatus.value = `${localApiResolved.target}|${localApiSupportsRequest ? 'supported' : 'unsupported'}`

  const previousAdapter = (wpi as any).getAdapter?.()
  const previousPlatform = (wpi as any).platform as string | undefined

  ;(wpi as any).setAdapter(adapter as any, 'wx')

  let fetchResponse: Response
  try {
    fetchResponse = await wevuFetch('https://example.com/subpath-entry', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        stage: 'e2e',
      }),
    })
  }
  finally {
    ;(wpi as any).setAdapter(previousAdapter, previousPlatform)
  }

  fetchStatus.value = `${fetchResponse.status}|${fetchResponse.headers.get('x-subpath-source') ?? 'none'}`
  const fetchJson = await fetchResponse.json() as Record<string, unknown>
  fetchPayload.value = JSON.stringify(fetchJson)

  await nextTick()

  const checks = {
    routerResolved: routerFullPath.value === '/pages/router-stability/target/index?from=subpath-entry&step=1',
    storeUpdated: scenarioRefs.count.value === 1 && scenarioRefs.label.value === 'subpath-ready',
    storePluginTouched: Boolean((scenarioStore as any).__subpathPluginTouched),
    localApiSupports: localApiSupportsRequest,
    localApiResolved: localApiResolved.target === 'request',
    fetchStatusOk: fetchResponse.status === 200,
    fetchPayloadOk: fetchJson.ok === true && fetchJson.source === 'subpath-adapter',
    fetchRequestCountOk: requestCount.value === 1,
    fetchBodyEchoOk: requestDataEcho.value.includes('"stage":"e2e"'),
  }

  const ok = Object.values(checks).every(Boolean)
  runSummary.value = ok ? 'ok' : 'fail'

  return {
    ok,
    checks,
    details: {
      routerFullPath: routerFullPath.value,
      store: {
        count: scenarioCount.value,
        label: scenarioLabel.value,
      },
      apiStatus: apiStatus.value,
      fetchStatus: fetchStatus.value,
      fetchPayload: fetchPayload.value,
      requestCount: requestCount.value,
      requestDataEcho: requestDataEcho.value,
      runSummary: runSummary.value,
    },
  }
}

const _runE2E = runE2E
</script>

<template>
  <view class="subpath-entries-page">
    <view class="subpath-entries-page__title">
      wevu 子路径入口综合场景
    </view>
    <view class="subpath-entries-page__subtitle">
      覆盖 wevu/router、wevu/store、wevu/api、wevu/fetch 的联动使用
    </view>

    <view id="subpath-router-fullpath" class="subpath-entries-page__line">
      router fullPath = {{ routerFullPath }}
    </view>
    <view id="subpath-store-summary" class="subpath-entries-page__line">
      store count/label = {{ scenarioCount }} / {{ scenarioLabel }}
    </view>
    <view id="subpath-api-status" class="subpath-entries-page__line">
      api status = {{ apiStatus }}
    </view>
    <view id="subpath-fetch-status" class="subpath-entries-page__line">
      fetch status = {{ fetchStatus }}
    </view>
    <view id="subpath-fetch-payload" class="subpath-entries-page__line">
      fetch payload = {{ fetchPayload }}
    </view>
    <view id="subpath-request-count" class="subpath-entries-page__line">
      request count = {{ requestCount }}
    </view>
    <view id="subpath-request-echo" class="subpath-entries-page__line">
      request body echo = {{ requestDataEcho }}
    </view>
    <view id="subpath-run-summary" class="subpath-entries-page__line">
      run summary = {{ runSummary }}
    </view>

    <view id="subpath-run-e2e" class="subpath-entries-page__btn" @tap="runE2E">
      run e2e scenario
    </view>
  </view>
</template>

<style scoped>
.subpath-entries-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #f8fafc;
}

.subpath-entries-page__title {
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.subpath-entries-page__subtitle {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #475569;
}

.subpath-entries-page__line {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #1e293b;
}

.subpath-entries-page__btn {
  min-height: 60rpx;
  padding: 0 20rpx;
  margin-top: 18rpx;
  font-size: 22rpx;
  line-height: 60rpx;
  color: #fff;
  background: #0f766e;
  border-radius: 9999rpx;
}
</style>
