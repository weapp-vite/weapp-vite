<script setup lang="ts">
import { computed } from 'vue'

import { useCoreTag } from '../../shared/core'
import { useSubOnlyTag } from '../../shared/sub-only'

const reportSummary = computed(() => `${useCoreTag()}|${useSubOnlyTag()}`)
</script>

<template>
  <view id="complex-a-report">
    {{ reportSummary }}
  </view>
</template>
