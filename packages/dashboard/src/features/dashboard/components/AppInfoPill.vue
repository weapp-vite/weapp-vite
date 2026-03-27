<script setup lang="ts">
import type { DashboardIconName } from '../types'
import DashboardIcon from './DashboardIcon.vue'

defineProps<{
  label: string
  iconName?: DashboardIconName
  uppercase?: boolean
}>()
</script>

<template>
  <span
    class="inline-flex items-center rounded-full border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-2.5 py-1 text-xs font-medium text-[color:var(--dashboard-text-soft)]"
    :class="uppercase ? 'tracking-[0.18em] uppercase' : undefined"
  >
    <span
      v-if="iconName"
      class="mr-1.5 h-4 w-4 text-[color:var(--dashboard-accent)]"
    >
      <DashboardIcon :name="iconName" />
    </span>
    {{ label }}
  </span>
</template>
