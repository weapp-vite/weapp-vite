<script setup lang="ts">
import type { WorkspaceSignalItem } from '../types'
import AppInsetPanel from './AppInsetPanel.vue'
import DashboardIcon from './DashboardIcon.vue'

defineProps<{
  items: WorkspaceSignalItem[]
}>()
</script>

<template>
  <AppInsetPanel eyebrow="rollout signal">
    <ul class="grid gap-2 text-sm">
      <li
        v-for="item in items"
        :key="item.label"
        class="flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel)] px-3 py-3"
      >
        <span class="inline-flex items-center gap-2">
          <span class="h-4.5 w-4.5 text-[color:var(--dashboard-accent)]">
            <DashboardIcon :name="item.iconName" />
          </span>
          {{ item.label }}
        </span>
        <strong class="text-[color:var(--dashboard-text)]">{{ item.value }}</strong>
      </li>
    </ul>
  </AppInsetPanel>
</template>
