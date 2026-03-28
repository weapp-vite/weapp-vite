<script setup lang="ts">
import type { DashboardRuntimeBadgeItem } from '../types'
import { computed } from 'vue'
import { runtimeBadgeStyles } from '../utils/styles'

const props = withDefaults(defineProps<{
  label: DashboardRuntimeBadgeItem['label']
  tone?: DashboardRuntimeBadgeItem['tone']
}>(), {
  tone: 'neutral',
})

const badgeClassName = computed(() => runtimeBadgeStyles({ tone: props.tone }))
</script>

<template>
  <span :class="badgeClassName">
    {{ label }}
  </span>
</template>
