<script setup lang="ts">
import type { DashboardLabelValueItem } from '../types'

defineProps<{
  items: DashboardLabelValueItem[]
}>()
</script>

<template>
  <ul class="grid gap-2">
    <li
      v-for="item in items"
      :key="item.label"
      class="flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel)] px-3 py-2.5"
    >
      <span class="text-xs uppercase tracking-[0.16em] text-[color:var(--dashboard-text-soft)]">
        {{ item.label }}
      </span>
      <strong class="text-sm text-[color:var(--dashboard-text)]">
        {{ item.value }}
      </strong>
    </li>
  </ul>
</template>
