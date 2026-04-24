<script setup lang="ts">
import type { DashboardSurfaceSampleItem } from '../types'

defineProps<{
  label: DashboardSurfaceSampleItem['label']
  tone: DashboardSurfaceSampleItem['tone']
}>()

function getSurfaceToneClassName(tone: DashboardSurfaceSampleItem['tone']): string {
  switch (tone) {
    case 'strong':
      return 'border border-(--dashboard-border-strong) bg-(--dashboard-panel-strong) shadow-(--dashboard-shadow)'
    case 'muted':
      return 'border border-(--dashboard-border) bg-(--dashboard-panel-muted)'
    default:
      return 'border border-(--dashboard-border) bg-(--dashboard-panel)'
  }
}
</script>

<template>
  <div
    class="rounded-4.5 p-4"
    :class="getSurfaceToneClassName(tone)"
  >
    {{ label }}
  </div>
</template>
