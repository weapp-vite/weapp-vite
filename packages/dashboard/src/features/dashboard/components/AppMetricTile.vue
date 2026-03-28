<script setup lang="ts">
import type { DashboardMetricItem } from '../types'
import AppMetaLabel from './AppMetaLabel.vue'

defineProps<{
  label: DashboardMetricItem['label']
  value: DashboardMetricItem['value']
}>()

const panelClassName = 'rounded-xl border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-3'
</script>

<template>
  <div :class="panelClassName">
    <AppMetaLabel>
      {{ label }}
    </AppMetaLabel>
    <p class="mt-1.5 text-base font-semibold text-[color:var(--dashboard-text)]">
      {{ value }}
    </p>
  </div>
</template>
