<script setup lang="ts">
import { computed } from 'vue'

import { useCoreTag } from '../../shared/core'
import { useTransitiveTag } from '../../shared/transitive'

const mainSummary = computed(() => `${useCoreTag()}|${useTransitiveTag()}`)
</script>

<template>
  <view id="complex-a-main">
    {{ mainSummary }}
  </view>
</template>
