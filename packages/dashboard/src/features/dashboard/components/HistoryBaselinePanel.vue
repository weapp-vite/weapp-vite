<script setup lang="ts">
import type { AnalyzeComparisonMode, AnalyzeHistorySnapshot } from '../types'
import { computed, ref } from 'vue'
import { formatBytes } from '../utils/format'
import { pillButtonStyles, surfaceStyles } from '../utils/styles'
import AppEmptyState from './AppEmptyState.vue'
import AppPanelHeader from './AppPanelHeader.vue'

type HistorySnapshotSortMode = 'capturedAt' | 'total' | 'compressed' | 'modules' | 'duplicates'

const props = defineProps<{
  snapshots: AnalyzeHistorySnapshot[]
  baselineSnapshotId: string | null
  comparisonMode: AnalyzeComparisonMode
}>()

const emit = defineEmits<{
  setBaseline: [id: string]
  setComparisonMode: [mode: AnalyzeComparisonMode]
}>()

const snapshotQuery = ref('')
const snapshotSortMode = ref<HistorySnapshotSortMode>('capturedAt')

function formatDelta(bytes: number) {
  if (bytes === 0) {
    return '无变化'
  }
  return `${bytes > 0 ? '+' : '-'}${formatBytes(Math.abs(bytes))}`
}

function formatSnapshotDate(snapshot: AnalyzeHistorySnapshot) {
  return new Date(snapshot.capturedAt).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function getSnapshotKeyword(snapshot: AnalyzeHistorySnapshot) {
  return [
    snapshot.id,
    snapshot.label,
    snapshot.capturedAt,
    snapshot.packageCount,
    snapshot.moduleCount,
    snapshot.duplicateCount,
    snapshot.totalBytes,
    snapshot.compressedBytes,
  ].join(' ').toLowerCase()
}

const baselineSnapshot = computed(() => props.snapshots.find(snapshot => snapshot.id === props.baselineSnapshotId) ?? null)
const currentSnapshot = computed(() => props.snapshots[0] ?? null)
const previousSnapshot = computed(() => props.snapshots[1] ?? null)
const baselineDelta = computed(() => {
  if (!currentSnapshot.value || !baselineSnapshot.value) {
    return ''
  }
  return formatDelta(currentSnapshot.value.totalBytes - baselineSnapshot.value.totalBytes)
})
const previousDelta = computed(() => {
  if (!currentSnapshot.value || !previousSnapshot.value) {
    return ''
  }
  return formatDelta(currentSnapshot.value.totalBytes - previousSnapshot.value.totalBytes)
})
const activeComparisonLabel = computed(() => {
  if (props.comparisonMode === 'baseline') {
    return baselineDelta.value || '未设置'
  }
  return previousDelta.value || '上次快照'
})
const baselineSummaryItems = computed(() => {
  const snapshot = baselineSnapshot.value
  if (!snapshot) {
    return []
  }
  return [
    { label: '基线体积', value: formatBytes(snapshot.totalBytes) },
    { label: '压缩后', value: formatBytes(snapshot.compressedBytes) },
    { label: '模块数', value: String(snapshot.moduleCount) },
    { label: '复用模块', value: String(snapshot.duplicateCount) },
  ]
})
const filteredSnapshots = computed(() => {
  const keyword = snapshotQuery.value.trim().toLowerCase()
  return props.snapshots
    .filter(snapshot => !keyword || getSnapshotKeyword(snapshot).includes(keyword))
    .sort((a, b) => {
      if (snapshotSortMode.value === 'total') {
        return b.totalBytes - a.totalBytes || Date.parse(b.capturedAt) - Date.parse(a.capturedAt)
      }
      if (snapshotSortMode.value === 'compressed') {
        return b.compressedBytes - a.compressedBytes || Date.parse(b.capturedAt) - Date.parse(a.capturedAt)
      }
      if (snapshotSortMode.value === 'modules') {
        return b.moduleCount - a.moduleCount || Date.parse(b.capturedAt) - Date.parse(a.capturedAt)
      }
      if (snapshotSortMode.value === 'duplicates') {
        return b.duplicateCount - a.duplicateCount || Date.parse(b.capturedAt) - Date.parse(a.capturedAt)
      }
      return Date.parse(b.capturedAt) - Date.parse(a.capturedAt)
    })
})
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

    <div class="mt-3 grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-2 overflow-hidden">
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

      <div class="grid gap-2">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs text-(--dashboard-text-soft)">
            匹配 {{ filteredSnapshots.length }} / {{ snapshots.length }} 个快照
          </p>
          <select
            v-model="snapshotSortMode"
            class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2.5 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-accent)"
          >
            <option value="capturedAt">
              按时间
            </option>
            <option value="total">
              按体积
            </option>
            <option value="compressed">
              按压缩后
            </option>
            <option value="modules">
              按模块数
            </option>
            <option value="duplicates">
              按复用模块
            </option>
          </select>
        </div>
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
