<script setup lang="ts">
import type { AnalyzeComparisonMode, AnalyzeHistorySnapshot } from '../types'
import { useHistoryBaselinePanel } from '../composables/useHistoryBaselinePanel'
import { formatBytes } from '../utils/format'
import { pillButtonStyles, surfaceStyles } from '../utils/styles'
import AppEmptyState from './AppEmptyState.vue'
import AppPanelHeader from './AppPanelHeader.vue'
import HistoryBaselineToolbar from './HistoryBaselineToolbar.vue'
import HistoryTrendPanel from './HistoryTrendPanel.vue'

const props = defineProps<{
  snapshots: AnalyzeHistorySnapshot[]
  baselineSnapshotId: string | null
  comparisonMode: AnalyzeComparisonMode
}>()

const emit = defineEmits<{
  setBaseline: [id: string]
  setComparisonMode: [mode: AnalyzeComparisonMode]
}>()

const {
  actionStatus,
  activeComparisonLabel,
  baselineSummaryItems,
  copyBaselineReport,
  exportFilteredSnapshots,
  filteredSnapshots,
  formatSnapshotDate,
  historyTrend,
  snapshotQuery,
  snapshotSortMode,
} = useHistoryBaselinePanel(props)
</script>

<template>
  <section :class="surfaceStyles({ padding: 'md' })" class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
    <AppPanelHeader icon-name="metric-history" title="历史基线">
      <template #meta>
        <div class="flex gap-1.5">
          <button
            type="button"
            :class="pillButtonStyles({ kind: 'badge', active: comparisonMode === 'previous' })"
            @click="emit('setComparisonMode', 'previous')"
          >
            上次
          </button>
          <button
            type="button"
            :class="pillButtonStyles({ kind: 'badge', active: comparisonMode === 'baseline' })"
            :disabled="!baselineSnapshotId"
            @click="emit('setComparisonMode', 'baseline')"
          >
            Baseline
          </button>
        </div>
      </template>
    </AppPanelHeader>

    <div class="mt-3 grid min-h-0 grid-rows-[auto_auto_auto_minmax(0,1fr)] gap-2 overflow-hidden">
      <div class="rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 py-2">
        <div class="flex items-center justify-between gap-3">
          <p class="text-xs text-(--dashboard-text-soft)">
            当前对比
          </p>
          <p class="text-sm font-medium text-(--dashboard-accent)">
            {{ activeComparisonLabel }}
          </p>
        </div>
        <div v-if="baselineSummaryItems.length" class="mt-3 grid grid-cols-2 gap-2">
          <div
            v-for="item in baselineSummaryItems"
            :key="item.label"
            class="rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-2.5 py-2"
          >
            <p class="text-[11px] text-(--dashboard-text-soft)">
              {{ item.label }}
            </p>
            <p class="mt-1 text-sm font-semibold text-(--dashboard-text)">
              {{ item.value }}
            </p>
          </div>
        </div>
      </div>

      <HistoryTrendPanel :trend="historyTrend" />

      <div class="grid gap-2">
        <HistoryBaselineToolbar
          v-model="snapshotSortMode"
          :action-status="actionStatus"
          :disabled="filteredSnapshots.length === 0"
          :filtered-count="filteredSnapshots.length"
          :total-count="snapshots.length"
          @copy="copyBaselineReport"
          @export-json="exportFilteredSnapshots"
        />
        <input
          v-model="snapshotQuery"
          class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 text-sm text-(--dashboard-text) outline-none transition placeholder:text-(--dashboard-text-soft) focus:border-(--dashboard-accent)"
          placeholder="搜索时间、标签或快照指标"
          type="search"
        >
      </div>

      <AppEmptyState v-if="filteredSnapshots.length === 0" compact>
        暂无历史快照。
      </AppEmptyState>

      <ol v-else class="grid min-h-0 gap-1.5 overflow-y-auto pr-1">
        <li
          v-for="snapshot in filteredSnapshots"
          :key="snapshot.id"
          class="list-none"
        >
          <button
            type="button"
            class="w-full rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 py-2 text-left transition hover:border-(--dashboard-border-strong) hover:bg-(--dashboard-panel)"
            :class="snapshot.id === baselineSnapshotId ? 'border-(--dashboard-accent) bg-(--dashboard-accent-soft)' : undefined"
            @click="emit('setBaseline', snapshot.id)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-(--dashboard-text)">
                  {{ formatSnapshotDate(snapshot) }}
                </p>
                <p class="mt-0.5 truncate text-xs text-(--dashboard-text-soft)">
                  {{ snapshot.packageCount }} 包 · {{ snapshot.moduleCount }} 模块 · 复用 {{ snapshot.duplicateCount }}
                </p>
              </div>
              <div class="text-right">
                <p class="whitespace-nowrap text-sm font-medium text-(--dashboard-accent)">
                  {{ formatBytes(snapshot.totalBytes) }}
                </p>
                <p class="mt-0.5 whitespace-nowrap text-xs text-(--dashboard-text-soft)">
                  {{ snapshot.id === baselineSnapshotId ? 'baseline' : formatBytes(snapshot.compressedBytes) }}
                </p>
              </div>
            </div>
          </button>
        </li>
      </ol>
    </div>
  </section>
</template>
