<script setup lang="ts">
import { ref } from 'wevu'
import { createWeapi } from 'wevu/api'

const resultSummary = ref<Array<{ name: string, sameIdentity: boolean, isPromise: boolean }>>([])
const voidSummary = ref<Array<{ name: string, isUndefined: boolean, isPromise: boolean }>>([])
const cacheOptionsSummary = ref('pending')

const directResultMethods = [
  'checkIsPictureInPictureActive',
  'createBufferURL',
  'createCacheManager',
  'createGlobalPayment',
  'createInferenceSession',
  'createVideoDecoder',
  'getApiCategory',
  'getAppAuthorizeSetting',
  'getAppBaseInfo',
  'getDeviceInfo',
  'getPluginUpdateManager',
  'getSystemSetting',
  'getWindowInfo',
  'isVKSupport',
] as const

const directVoidMethods = [
  'postMessageToReferrerMiniProgram',
  'postMessageToReferrerPage',
  'reportEvent',
  'reportMonitor',
  'reportPerformance',
  'requestAppleSubscribeSign',
  'revokeBufferURL',
] as const

const directResults: Record<string, { name: string }> = {}
for (const name of [...directResultMethods, ...directVoidMethods]) {
  directResults[name] = { name }
}
let lastCacheManagerOptions: Record<string, unknown> | undefined
const adapter: Record<string, (...args: unknown[]) => unknown> = {}
for (const name of directResultMethods) {
  adapter[name] = (...args: unknown[]) => {
    if (name === 'createCacheManager') {
      const options = args[0]
      lastCacheManagerOptions = options && typeof options === 'object'
        ? options as Record<string, unknown>
        : undefined
    }
    return directResults[name]
  }
}
for (const name of directVoidMethods) {
  adapter[name] = () => undefined
}

const api = createWeapi({
  adapter,
  platform: 'wx',
}) as Record<string, (...args: unknown[]) => unknown>

function isPromise(value: unknown) {
  return Boolean(value && typeof (value as { then?: unknown }).then === 'function')
}

function _runE2E() {
  const resultMethods = directResultMethods.map((name) => {
    const value = api[name](name === 'createCacheManager' ? { maxSize: 1 } : undefined)
    return {
      name,
      sameIdentity: value === directResults[name],
      isPromise: isPromise(value),
    }
  })
  const voidMethods = directVoidMethods.map((name) => {
    const value = api[name]()
    return {
      name,
      isUndefined: value === undefined,
      isPromise: isPromise(value),
    }
  })
  resultSummary.value = resultMethods
  voidSummary.value = voidMethods
  cacheOptionsSummary.value = Object.keys(lastCacheManagerOptions ?? {}).sort().join(',')
  return {
    resultMethods,
    voidMethods,
    cacheManagerOptions: Object.keys(lastCacheManagerOptions ?? {}).sort(),
  }
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <view id="issue-941-page">
    <view id="issue941-title">issue-941 direct-return adapter</view>
    <view
      v-for="item in resultSummary"
      :id="`issue941-${item.name}`"
      :key="item.name"
      class="issue941-result"
    >
      {{ item.name }}: identity {{ item.sameIdentity ? 'preserved' : 'changed' }}, promise {{ item.isPromise ? 'yes' : 'no' }}
    </view>
    <view
      v-for="item in voidSummary"
      :id="`issue941-${item.name}`"
      :key="item.name"
      class="issue941-void"
    >
      {{ item.name }}: undefined {{ item.isUndefined ? 'yes' : 'no' }}, promise {{ item.isPromise ? 'yes' : 'no' }}
    </view>
    <view id="issue941-cache-options">cache options: {{ cacheOptionsSummary }}</view>
  </view>
</template>
