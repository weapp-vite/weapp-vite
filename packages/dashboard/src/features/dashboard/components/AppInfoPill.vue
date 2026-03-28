<script setup lang="ts">
import type { DashboardInfoPillItem } from '../types'
import { computed } from 'vue'
import DashboardIcon from './DashboardIcon.vue'

const props = defineProps<{
  label: DashboardInfoPillItem['label']
  iconName?: DashboardInfoPillItem['iconName']
  uppercase?: boolean
}>()

const textClassName = computed(() => props.uppercase ? 'tracking-[0.18em] uppercase' : undefined)
</script>

<template>
  <span
    class="inline-flex items-center rounded-full border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-2.5 py-1 text-xs font-medium text-[color:var(--dashboard-text-soft)]"
    :class="textClassName"
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
