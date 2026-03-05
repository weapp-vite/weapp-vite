<script setup lang="ts">
import { computed } from 'vue'

import { useClusterTag } from '../../shared/sub-cluster'

const betaSummary = computed(() => useClusterTag())
</script>

<template>
  <view id="complex-b-beta">
    {{ betaSummary }}
  </view>
</template>
