<script setup lang="ts">
import { useNativeInstance } from 'wevu'

const nativeInstance = useNativeInstance()

function _runE2E() {
  return {
    dataSlotOwnerId: (nativeInstance as any)?.data?.__wvSlotOwnerId,
    propsSlotOwnerId: (nativeInstance as any)?.properties?.__wvSlotOwnerId,
  }
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <view class="issue642-scoped-slot-probe">
    <slot :io="1234" />
  </view>
</template>
