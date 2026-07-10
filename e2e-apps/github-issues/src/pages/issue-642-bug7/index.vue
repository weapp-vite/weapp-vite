<script setup lang="ts">
import { ref, useNativeInstance } from 'wevu'
import Issue642Bug7Cell1 from '../../components/issue-642-bug7/Cell1/index.vue'
import Issue642Bug7Cell2 from '../../components/issue-642-bug7/Cell2/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-642-bug7',
})
definePageMeta({
  layout: false,
})

const tick = ref(0)
const nativeInstance = useNativeInstance()

function readChild(selector: string) {
  return (nativeInstance as any).selectComponent?.(selector) ?? null
}

function normalizeVueSlots(value: unknown) {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function readSlotState(selector: string) {
  const child = readChild(selector)
  const dataSlots = normalizeVueSlots(child?.data?.vueSlots)
  const propertySlots = normalizeVueSlots(child?.properties?.vueSlots)

  return {
    dataVueSlots: dataSlots,
    propertyVueSlots: propertySlots,
    hasDefault: Boolean(dataSlots?.default || propertySlots?.default),
  }
}

function readScopedState(selector: string) {
  const child = readChild(selector)
  return {
    dataSlotOwnerId: child?.data?.__wvSlotOwnerId,
    propsSlotOwnerId: child?.properties?.__wvSlotOwnerId,
    dataSlotScope: child?.data?.__wvSlotScope,
    propsSlotScope: child?.properties?.__wvSlotScope,
  }
}

function bump() {
  tick.value += 1
}

function _runE2E(action?: 'bump') {
  if (action === 'bump') {
    bump()
  }
  const runtime = (nativeInstance as any).__wevu
  return {
    tick: tick.value,
    owner: {
      dataOwnerId: (nativeInstance as any).data?.__wvOwnerId,
      runtimeOwnerId: runtime?.state?.__wvOwnerId,
      dataBind0: (nativeInstance as any).data?.__wv_bind_0,
      dataBind1: (nativeInstance as any).data?.__wv_bind_1,
      runtimeBind0: runtime?.computed?.__wv_bind_0,
      runtimeBind1: runtime?.computed?.__wv_bind_1,
    },
    scoped: readScopedState('#issue642-bug7-cell1'),
    provided: readSlotState('#issue642-bug7-cell2'),
  }
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <view
    id="issue642-bug7-page"
    class="issue642-bug7-page"
    data-e2e-issue="642-bug7"
  >
    <button
      class="issue642-bug7-action"
      data-issue642-bug7-action="bump"
      @tap="bump"
    >
      bump {{ tick }}
    </button>
    <Issue642Bug7Cell1 id="issue642-bug7-cell1">
      <template #default="{ io }">
        <text
          data-issue642-bug7-cell1-state="scoped"
          :data-issue642-bug7-scoped-value="io"
        >
          {{ io }}
        </text>
      </template>
    </Issue642Bug7Cell1>
    <Issue642Bug7Cell2 id="issue642-bug7-cell2">
      <text data-issue642-bug7-cell2-state="provided">1234</text>
    </Issue642Bug7Cell2>
  </view>
</template>

<style scoped>
.issue642-bug7-page {
  min-height: 100vh;
  padding: 24rpx;
}

.issue642-bug7-action {
  margin-bottom: 24rpx;
}
</style>
