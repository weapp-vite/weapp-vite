<script setup lang="ts">
import { createWeapi } from 'wevu/api'

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
  <view id="issue-941-page">issue-941</view>
</template>
