<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from 'wevu'

import { useCoreTag } from '../../shared/core'
import { usePairOnlyTag } from '../../shared/pair-only'
import { useSubOnlyTag } from '../../shared/sub-only'

const userSummary = `${useCoreTag()}|${useSubOnlyTag()}|${usePairOnlyTag()}`
const asyncSummary = ref('pending')

onLoad(async () => {
  const mod = await import('../../shared/async-only')
  asyncSummary.value = mod.useAsyncOnlyTag()
})
</script>

<template>
  <view id="complex-a-user">
    <view>{{ userSummary }}</view>
    <view>{{ asyncSummary }}</view>
  </view>
</template>
