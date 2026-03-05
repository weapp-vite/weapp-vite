<script setup lang="ts">
import { computed } from 'vue'

import { useEdgeTag, useRuntimeChainTag } from '../../shared/deep'

const alphaSummary = computed(() => `${useRuntimeChainTag()}|${useEdgeTag()}`)
</script>

<template>
  <view id="complex-b-alpha">
    {{ alphaSummary }}
  </view>
</template>
