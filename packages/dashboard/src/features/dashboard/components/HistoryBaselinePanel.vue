<script setup lang="ts">
import type { AnalyzeComparisonMode, AnalyzeHistorySnapshot } from '../types'
import { computed } from 'vue'
import { formatBytes } from '../utils/format'
import { pillButtonStyles, surfaceStyles } from '../utils/styles'
import AppEmptyState from './AppEmptyState.vue'
import AppPanelHeader from './AppPanelHeader.vue'

const props = defineProps<{
  snapshots: AnalyzeHistorySnapshot[]
  baselineSnapshotId: string | null
  comparisonMode: AnalyzeComparisonMode
}>()

const emit = defineEmits<{
  setBaseline: [id: string]
  setComparisonMode: [mode: AnalyzeComparisonMode]
}>()

const visibleSnapshots = computed(() => props.snapshots.slice(0, 4))
const baselineSnapshot = computed(() => props.snapshots.find(snapshot => snapshot.id === props.baselineSnapshotId) ?? null)
const currentSnapshot = computed(() => props.snapshots[0] ?? null)
const baselineDelta = computed(() => {
  if (!currentSnapshot.value || !baselineSnapshot.value) {
    return ''
  }
  const delta = currentSnapshot.value.totalBytes - baselineSnapshot.value.totalBytes
  if (delta === 0) {
    return '无变化'
  }
  return `${delta > 0 ? '+' : '-'}${formatBytes(Math.abs(delta))}`
})
</script>

<template>
  <section :class="surfaceStyles({ padding: 'md' })" class="h-full min-h-0 overflow-hidden">
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

    <div class="mt-3 grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden">
      <div class="rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 py-2">
        <div class="flex items-center justify-between gap-3">
          <p class="text-xs text-(--dashboard-text-soft)">
            当前对比
          </p>
          <p class="text-sm font-medium text-(--dashboard-accent)">
            {{ comparisonMode === 'baseline' ? baselineDelta || '未设置' : '上次快照' }}
          </p>
        </div>
      </div>

      <AppEmptyState v-if="visibleSnapshots.length === 0" compact>
        暂无历史快照。
      </AppEmptyState>

      <ol v-else class="grid min-h-0 gap-1.5 overflow-y-auto pr-1">
        <li
          v-for="snapshot in visibleSnapshots"
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
                  {{ snapshot.label }}
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
