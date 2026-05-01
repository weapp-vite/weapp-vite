<script setup lang="ts">
import type { ReleaseGateSummary } from '../utils/releaseGate'
import AppMetricTile from './AppMetricTile.vue'
import AppPanelHeader from './AppPanelHeader.vue'
import DashboardIcon from './DashboardIcon.vue'

defineProps<{
  gate: ReleaseGateSummary
  copyStatus: string
}>()

const emit = defineEmits<{
  copy: []
}>()

function getStatusClassName(status: ReleaseGateSummary['status']) {
  if (status === 'blocked') {
    return 'border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/12 dark:text-rose-300'
  }
  if (status === 'review') {
    return 'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/12 dark:text-amber-300'
  }
  return 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-300'
}
</script>

<template>
  <section class="rounded-lg border border-(--dashboard-border) bg-(--dashboard-panel) p-4 shadow-(--dashboard-shadow)">
    <AppPanelHeader icon-name="metric-quality" title="发布门禁">
      <template #meta>
        <div class="flex items-center gap-2">
          <span v-if="copyStatus" class="text-xs font-medium text-(--dashboard-accent)">
            {{ copyStatus }}
          </span>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 py-1 text-[11px] text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-text)"
            @click="emit('copy')"
          >
            <span class="h-3.5 w-3.5">
              <DashboardIcon name="metric-copy" />
            </span>
            复制门禁
          </button>
        </div>
      </template>
    </AppPanelHeader>

    <div class="mt-3 grid gap-3 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)]">
      <div class="rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) p-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <span class="inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em]" :class="getStatusClassName(gate.status)">
              {{ gate.label }}
            </span>
            <p class="mt-3 text-lg font-semibold text-(--dashboard-text)">
              {{ gate.headline }}
            </p>
            <p class="mt-1 text-xs leading-5 text-(--dashboard-text-soft)">
              {{ gate.description }}
            </p>
          </div>
          <div class="shrink-0 text-right">
            <p class="text-[11px] uppercase tracking-[0.18em] text-(--dashboard-text-soft)">
              score
            </p>
            <p class="mt-1 text-3xl font-semibold text-(--dashboard-accent)">
              {{ gate.score }}
            </p>
          </div>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
        <div class="grid grid-cols-2 gap-2">
          <AppMetricTile
            v-for="metric in gate.metrics"
            :key="metric.label"
            v-bind="metric"
          />
        </div>
        <ol class="grid content-start gap-1.5 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) p-3 text-xs text-(--dashboard-text-muted)">
          <li
            v-for="item in gate.recommendations"
            :key="item"
            class="line-clamp-2"
          >
            {{ item }}
          </li>
          <li v-if="gate.recommendations.length === 0">
            当前没有需要立即处理的事项。
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>
