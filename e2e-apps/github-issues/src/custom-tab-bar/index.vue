<script setup lang="ts">
import { getCurrentInstance, onReady, ref } from 'wevu'

const ready = ref(false)
const layoutWrapperDetected = ref(false)
const instance = getCurrentInstance() as any

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
