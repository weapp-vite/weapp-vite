<script setup lang="ts">
import type { PackageHealthItem, PackageHealthSummary } from '../utils/packageHealth'
import AppMetricTile from './AppMetricTile.vue'
import AppPanelHeader from './AppPanelHeader.vue'

defineProps<{
  health: PackageHealthSummary
}>()

function getStatusClassName(status: PackageHealthItem['status']) {
  if (status === 'risk') {
    return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300'
  }
  if (status === 'watch') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300'
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300'
}
</script>

<template>
  <section class="rounded-lg border border-(--dashboard-border) bg-(--dashboard-panel) p-4 shadow-(--dashboard-shadow)">
    <AppPanelHeader
      icon-name="metric-health"
      title="包体健康"
      :description="health.weakestPackage ? `优先关注 ${health.weakestPackage.label}` : '当前没有包体样本'"
    />

    <div class="mt-3 grid gap-3 xl:grid-cols-[minmax(0,0.45fr)_minmax(0,1fr)]">
      <div class="grid grid-cols-3 gap-2">
        <AppMetricTile label="平均分" :value="health.averageScore" />
        <AppMetricTile label="高风险" :value="health.riskCount" />
        <AppMetricTile label="需关注" :value="health.watchCount" />
      </div>

      <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="item in health.items.slice(0, 3)"
          :key="item.id"
          class="rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) p-3"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-(--dashboard-text)">
                {{ item.label }}
              </p>
              <p class="mt-1 text-xs leading-5 text-(--dashboard-text-soft)">
                {{ item.detail }}
              </p>
            </div>
            <span class="shrink-0 rounded-full border px-2 py-0.5 text-[11px]" :class="getStatusClassName(item.status)">
              {{ item.statusLabel }}
            </span>
          </div>

          <div class="mt-3 flex items-end justify-between gap-3">
            <p class="text-3xl font-semibold text-(--dashboard-accent)">
              {{ item.score }}
            </p>
            <p class="line-clamp-2 text-right text-xs leading-5 text-(--dashboard-text-muted)">
              {{ item.primaryRisk }}
            </p>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
