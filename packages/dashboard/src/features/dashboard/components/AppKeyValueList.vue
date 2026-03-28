<script setup lang="ts">
import type { DashboardLabelValueItem } from '../types'
import { computed } from 'vue'

interface KeyValueRowItem {
  key: string
  label: string
  value: string
}

const props = defineProps<{
  items: DashboardLabelValueItem[]
}>()

const rowClassName = 'flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel)] px-3 py-2.5'

function createKeyValueRow(item: DashboardLabelValueItem): KeyValueRowItem {
  return {
    key: item.label,
    label: item.label,
    value: item.value,
  }
}

const rows = computed(() => props.items.map(item => createKeyValueRow(item)))
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
