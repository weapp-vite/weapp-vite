<script setup lang="ts">
import type { DashboardRuntimeBadgeItem } from '../types'
import { runtimeBadgeStyles } from '../utils/styles'

const props = withDefaults(defineProps<{
  label: DashboardRuntimeBadgeItem['label']
  tone?: DashboardRuntimeBadgeItem['tone']
}>(), {
  tone: 'neutral',
})
</script>

<template>
  <span :class="runtimeBadgeStyles({ tone: props.tone })">
    {{ label }}
  </span>
</template>
