<script setup lang="ts">
import type { PrReviewChecklistItem, PrReviewChecklistSummary } from '../utils/prReviewChecklist'
import AppMetricTile from './AppMetricTile.vue'
import AppPanelHeader from './AppPanelHeader.vue'
import DashboardIcon from './DashboardIcon.vue'

defineProps<{
  checklist: PrReviewChecklistSummary
  copyStatus: string
}>()

const emit = defineEmits<{
  copy: []
  select: [item: PrReviewChecklistItem]
}>()

function getStatusClassName(status: PrReviewChecklistSummary['status']) {
  if (status === 'blocked') {
    return 'border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/12 dark:text-rose-300'
  }
  if (status === 'review') {
    return 'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/12 dark:text-amber-300'
  }
  return 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-300'
}

function getToneClassName(tone: PrReviewChecklistItem['tone']) {
  if (tone === 'critical') {
    return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300'
  }
  if (tone === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300'
  }
  if (tone === 'success') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300'
  }
  return 'border-(--dashboard-border) bg-(--dashboard-panel-muted) text-(--dashboard-text-muted)'
}
</script>

<template>
  <section class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden">
    <div class="rounded-lg border border-(--dashboard-border) bg-(--dashboard-panel) p-4 shadow-(--dashboard-shadow)">
      <AppPanelHeader icon-name="metric-bookmark" title="PR 风险清单">
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
              复制清单
            </button>
          </div>
        </template>
      </AppPanelHeader>

      <div class="mt-3 grid gap-3 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)]">
        <div class="rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) p-3">
          <span class="inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em]" :class="getStatusClassName(checklist.status)">
            {{ checklist.label }}
          </span>
          <p class="mt-3 text-lg font-semibold text-(--dashboard-text)">
            {{ checklist.headline }}
          </p>
          <p class="mt-1 text-xs leading-5 text-(--dashboard-text-soft)">
            {{ checklist.description }}
          </p>
        </div>

        <div class="grid grid-cols-2 gap-2 md:grid-cols-4">
          <AppMetricTile
            v-for="metric in checklist.metrics"
            :key="metric.label"
            v-bind="metric"
          />
        </div>
      </div>
    </div>

    <div class="grid min-h-0 gap-2 overflow-y-auto pr-1 xl:grid-cols-3 xl:overflow-hidden xl:pr-0">
      <section
        v-for="lane in checklist.lanes"
        :key="lane.key"
        class="grid min-h-[18rem] grid-rows-[auto_minmax(0,1fr)] rounded-lg border border-(--dashboard-border) bg-(--dashboard-panel) p-4 shadow-(--dashboard-shadow)"
      >
        <div>
          <p class="text-sm font-semibold text-(--dashboard-text)">
            {{ lane.title }}
          </p>
          <p class="mt-1 text-xs leading-5 text-(--dashboard-text-soft)">
            {{ lane.description }}
          </p>
        </div>

        <div class="mt-3 min-h-0 overflow-y-auto pr-1">
          <div v-if="lane.items.length === 0" class="rounded-md border border-dashed border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 py-4 text-sm text-(--dashboard-text-muted)">
            {{ lane.emptyText }}
          </div>

          <button
            v-for="item in lane.items"
            :key="item.id"
            type="button"
            class="mb-2 grid w-full grid-cols-[1rem_minmax(0,1fr)] gap-2 rounded-md border px-3 py-2.5 text-left transition hover:border-(--dashboard-border-strong)"
            :class="getToneClassName(item.tone)"
            @click="emit('select', item)"
          >
            <span class="mt-0.5 flex h-4 w-4 items-center justify-center rounded border border-current text-[10px] leading-none">
              {{ item.checked ? '✓' : '' }}
            </span>
            <span class="min-w-0">
              <span class="block text-sm font-medium text-(--dashboard-text)">
                {{ item.title }}
              </span>
              <span class="mt-1 line-clamp-2 block text-xs leading-5 text-(--dashboard-text-muted)">
                {{ item.detail }}
              </span>
            </span>
          </button>
        </div>
      </section>
    </div>
  </section>
</template>
