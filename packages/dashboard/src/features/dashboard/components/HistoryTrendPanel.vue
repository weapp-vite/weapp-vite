<script setup lang="ts">
import type { HistoryTrendSummary } from '../utils/historyTrend'
import AppMetricTile from './AppMetricTile.vue'

defineProps<{
  trend: HistoryTrendSummary
}>()

function getStatusClassName(status: HistoryTrendSummary['status']) {
  if (status === 'growing') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300'
  }
  if (status === 'shrinking') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300'
  }
  if (status === 'stable') {
    return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300'
  }
  return 'border-(--dashboard-border) bg-(--dashboard-panel-muted) text-(--dashboard-text-muted)'
}
</script>

<template>
  <section class="rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) p-3">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <span class="inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium" :class="getStatusClassName(trend.status)">
          {{ trend.label }}
        </span>
        <p class="mt-2 text-sm font-semibold text-(--dashboard-text)">
          {{ trend.headline }}
        </p>
        <p class="mt-1 text-xs leading-5 text-(--dashboard-text-soft)">
          {{ trend.description }}
        </p>
      </div>
    </div>

    <div class="mt-3 grid grid-cols-2 gap-2">
      <AppMetricTile
        v-for="metric in trend.metrics"
        :key="metric.label"
        v-bind="metric"
      />
    </div>
  </section>
</template>
