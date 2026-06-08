<script setup lang="ts">
import { useNativeInstance } from 'wevu'
import Issue642Bug8Cell from '../Cell/index.vue'

const nativeInstance = useNativeInstance()

function _runE2E() {
  const child = (nativeInstance as any).selectComponent?.('#issue642-bug8-wrapped-cell') ?? null
  return {
    owner: {
      dataOwnerId: (nativeInstance as any).data?.__wvOwnerId,
      runtimeOwnerId: (nativeInstance as any).__wevu?.state?.__wvOwnerId,
    },
    child: {
      dataSlotOwnerId: child?.data?.__wvSlotOwnerId,
      propsSlotOwnerId: child?.properties?.__wvSlotOwnerId,
      dataSlotScope: child?.data?.__wvSlotScope,
      propsSlotScope: child?.properties?.__wvSlotScope,
    },
  }
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <Issue642Bug8Cell id="issue642-bug8-wrapped-cell">
    <template #default="{ io }">
      <text
        data-issue642-bug8-case="wrapped"
        :data-issue642-bug8-value="io"
      >
        {{ io }}
      </text>
    </template>
  </Issue642Bug8Cell>
</template>
