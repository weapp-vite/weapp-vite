<script setup lang="ts">
import { useNativeInstance } from 'wevu'
import Issue642Bug8Cell from '../../components/issue-642-bug8/Cell/index.vue'
import Issue642Bug8Wrap from '../../components/issue-642-bug8/Wrap/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-642-bug8',
})
definePageMeta({
  layout: false,
})

const nativeInstance = useNativeInstance()

function readChild(selector: string) {
  return (nativeInstance as any).selectComponent?.(selector) ?? null
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

function _runE2E() {
  const runtime = (nativeInstance as any).__wevu
  const wrap = readChild('#issue642-bug8-wrap')
  return {
    owner: {
      dataOwnerId: (nativeInstance as any).data?.__wvOwnerId,
      runtimeOwnerId: runtime?.state?.__wvOwnerId,
    },
    direct: readScopedState('#issue642-bug8-direct-cell'),
    wrap: wrap?._runE2E?.(),
  }
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <view
    id="issue642-bug8-page"
    class="issue642-bug8-page"
    data-e2e-issue="642-bug8"
  >
    <Issue642Bug8Cell id="issue642-bug8-direct-cell">
      <template #default="{ io }">
        <text
          data-issue642-bug8-case="direct"
          :data-issue642-bug8-value="io"
        >
          {{ io }}
        </text>
      </template>
    </Issue642Bug8Cell>

    <Issue642Bug8Wrap id="issue642-bug8-wrap" />
  </view>
</template>

<style scoped>
.issue642-bug8-page {
  min-height: 100vh;
  padding: 24rpx;
}
</style>
