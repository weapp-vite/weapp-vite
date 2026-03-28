<script setup lang="ts">
import type { DashboardKeyedLabelValueItem, DashboardLabelValueItem } from '../types'
import { computed } from 'vue'

const props = defineProps<{
  items: DashboardLabelValueItem[]
}>()

const rowClassName = 'flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel)] px-3 py-2.5'

const rows = computed<DashboardKeyedLabelValueItem[]>(() => props.items.map(item => ({
  key: item.label,
  label: item.label,
  value: item.value,
})))
</script>

<template>
  <ul class="grid gap-2">
    <li
      v-for="item in rows"
      :key="item.key"
      :class="rowClassName"
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
