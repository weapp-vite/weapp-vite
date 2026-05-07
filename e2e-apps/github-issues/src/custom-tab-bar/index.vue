<script setup lang="ts">
import { getCurrentInstance, onReady, ref } from 'wevu'
import { useRoute } from 'wevu/router'

const ready = ref(false)
const layoutWrapperDetected = ref(false)
const instance = getCurrentInstance() as any
const route = useRoute()

async function inspectLayoutWrapper() {
  const query = instance?.createSelectorQuery?.()
  if (!query) {
    ready.value = true
    return
  }

  await new Promise<void>((resolve) => {
    query
      .select('.issue-380-default-layout')
      .boundingClientRect((rect: WechatMiniprogram.BoundingClientRectCallbackResult | null) => {
        layoutWrapperDetected.value = Boolean(rect)
      })
      .exec(() => {
        ready.value = true
        resolve()
      })
  })
}

function _runE2E() {
  return {
    ready: ready.value,
    layoutWrapperDetected: layoutWrapperDetected.value,
    route: {
      path: route.path,
      fullPath: route.fullPath,
      query: route.query,
      hash: route.hash,
    },
  }
}

onReady(() => {
  void inspectLayoutWrapper()
})

defineExpose({
  _runE2E,
  ready,
  layoutWrapperDetected,
})
</script>

<template>
  <view class="issue-380-custom-tab-bar">
    <text>issue-380 custom tab bar</text>
  </view>
</template>
