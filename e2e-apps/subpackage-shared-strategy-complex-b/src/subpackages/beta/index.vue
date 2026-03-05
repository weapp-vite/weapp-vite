<script setup lang="ts">
import { computed } from 'vue'

import { useBetaOnlyNpmTag } from '../../shared/beta-only'
import { useClusterTag } from '../../shared/sub-cluster'

const betaSummary = computed(() => `${useClusterTag()}|${useBetaOnlyNpmTag()}`)
</script>

<template>
  <view id="complex-b-beta">
    {{ betaSummary }}
  </view>
</template>
