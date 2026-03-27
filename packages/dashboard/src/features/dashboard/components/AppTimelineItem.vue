<script setup lang="ts">
import type { DashboardIconName } from '../types'
import DashboardIcon from './DashboardIcon.vue'

defineProps<{
  title: string
  time: string
  summary: string
  iconName: DashboardIconName
}>()
</script>

<template>
  <li class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-4">
    <div class="flex items-start gap-3">
      <span class="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--dashboard-accent-soft)] text-[color:var(--dashboard-accent)]">
        <span class="h-5 w-5">
          <DashboardIcon :name="iconName" />
        </span>
      </span>
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <strong class="tracking-tight">{{ title }}</strong>
          <span class="rounded-full border border-[color:var(--dashboard-border)] px-2 py-0.5 text-[11px] uppercase tracking-[0.18em] text-[color:var(--dashboard-text-soft)]">
            {{ time }}
          </span>
        </div>
        <p class="mt-2 text-sm leading-6 text-[color:var(--dashboard-text-muted)]">
          {{ summary }}
        </p>
      </div>
    </div>
  </li>
</template>
