<script setup lang="ts">
import type { DashboardRuntimeBadgeItem } from '../types'
import { runtimeBadgeStyles } from '../utils/styles'

withDefaults(defineProps<{
  label: DashboardRuntimeBadgeItem['label']
  tone?: DashboardRuntimeBadgeItem['tone']
}>(), {
  tone: 'neutral',
})
</script>

<template>
  <span :class="runtimeBadgeStyles({ tone })">
    {{ label }}
  </span>
</template>
