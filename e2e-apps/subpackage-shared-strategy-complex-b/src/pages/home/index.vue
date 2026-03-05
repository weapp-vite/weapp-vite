<script setup lang="ts">
import { computed } from 'vue'

import { useBaseTag } from '../../shared/base'
import { useMathTag } from '../../shared/deep/math'

const homeSummary = computed(() => `${useBaseTag()}|${useMathTag()}`)
</script>

<template>
  <view id="complex-b-home">
    {{ homeSummary }}
  </view>
</template>
