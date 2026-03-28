<script setup lang="ts">
import type { DashboardSurfaceSampleItem } from '../types'

defineProps<{
  label: DashboardSurfaceSampleItem['label']
  tone: DashboardSurfaceSampleItem['tone']
}>()

function getSurfaceToneClassName(tone: DashboardSurfaceSampleItem['tone']): string {
  switch (tone) {
    case 'strong':
      return 'border border-[color:var(--dashboard-border-strong)] bg-[color:var(--dashboard-panel-strong)] shadow-[var(--dashboard-shadow)]'
    case 'muted':
      return 'border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)]'
    default:
      return 'border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel)]'
  }
}
</script>

<template>
  <div
    class="rounded-[18px] p-4"
    :class="getSurfaceToneClassName(tone)"
  >
    {{ label }}
  </div>
</template>
