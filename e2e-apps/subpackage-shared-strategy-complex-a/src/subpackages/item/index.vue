<script setup lang="ts">
import { computed } from 'vue'

import { useChainTag } from '../../shared/chain'
import { useCoreTag } from '../../shared/core'
import { useItemOnlyNpmTag } from '../../shared/item-only'
import { useSubOnlyTag } from '../../shared/sub-only'

const itemSummary = computed(() => `${useCoreTag()}|${useSubOnlyTag()}|${useChainTag()}|${useItemOnlyNpmTag()}`)
</script>

<template>
  <view id="complex-a-item">
    {{ itemSummary }}
  </view>
</template>
