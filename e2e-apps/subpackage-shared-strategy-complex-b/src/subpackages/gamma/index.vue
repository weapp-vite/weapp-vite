<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from 'wevu'

import { useEdgeTag, useRuntimeChainTag } from '../../shared/deep'

const gammaSummary = `${useRuntimeChainTag()}|${useEdgeTag()}`
const lazySummary = ref('pending')

onLoad(async () => {
  const mod = await import('../../shared/lazy')
  lazySummary.value = mod.useLazyTag()
})
</script>

<template>
  <view id="complex-b-gamma">
    <view id="complex-b-gamma-sync">{{ gammaSummary }}</view>
    <view id="complex-b-gamma-lazy">{{ lazySummary }}</view>
  </view>
</template>
