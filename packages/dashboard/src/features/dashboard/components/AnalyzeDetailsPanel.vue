<script setup lang="ts">
import type { DashboardDetailItem, LargestFileEntry, PackageBudgetLimitItem, PackageBudgetWarning, SelectedFileModuleDetail, TreemapNodeMeta } from '../types'
import { computed } from 'vue'
import { formatBytes, formatPackageType } from '../utils/format'
import AnalyzeDraggableGrid from './AnalyzeDraggableGrid.vue'
import AppCompactListItem from './AppCompactListItem.vue'
import AppEmptyState from './AppEmptyState.vue'

const props = defineProps<{
  visibleLargestFiles: LargestFileEntry[]
  selectedFileModules: SelectedFileModuleDetail[]
  budgetWarnings: PackageBudgetWarning[]
  budgetLimitItems: PackageBudgetLimitItem[]
  activeBudgetWarningId: string | null
  activeLargestFileKey: string | null
  selectedTreemapMeta: TreemapNodeMeta | null
}>()

const emit = defineEmits<{
  selectFile: [file: LargestFileEntry]
  selectBudgetWarning: [warning: PackageBudgetWarning]
}>()

const detailLayoutItems = [
  { id: 'top-files', label: 'Top Files' },
  { id: 'file-modules', label: '文件详情' },
  { id: 'budget', label: '预算' },
]

function formatDelta(bytes?: number) {
  if (typeof bytes !== 'number' || Number.isNaN(bytes) || bytes === 0) {
    return ''
  }
  return `${bytes > 0 ? '+' : '-'}${formatBytes(Math.abs(bytes))}`
}

function createLargestFileItem(file: LargestFileEntry): DashboardDetailItem {
  const delta = formatDelta(file.sizeDeltaBytes)
  return {
    title: file.file,
    meta: `${file.packageLabel} · ${formatPackageType(file.packageType)} · ${file.type}${delta ? ` · ${delta}` : ''}`,
    value: `${formatBytes(file.size)} / ${formatBytes(file.compressedSize)}`,
  }
}

function createBudgetItem(item: PackageBudgetWarning): DashboardDetailItem {
  return {
    title: item.label,
    meta: `${item.status === 'critical' ? '已超预算' : '接近预算'} · ${(item.ratio * 100).toFixed(1)}%`,
    value: `${formatBytes(item.currentBytes)} / ${formatBytes(item.limitBytes)}`,
  }
}

function formatSelectedMeta(meta: TreemapNodeMeta): DashboardDetailItem {
  if (meta.kind === 'package') {
    return {
      title: meta.packageLabel,
      meta: `${formatPackageType(meta.packageType)} · ${meta.fileCount} 个产物`,
      value: formatBytes(meta.totalBytes),
    }
  }
  if (meta.kind === 'file') {
    return {
      title: meta.fileName,
      meta: `${meta.packageLabel} · ${meta.type} · ${meta.childCount} 项`,
      value: formatBytes(meta.bytes),
    }
  }
  if (meta.kind === 'module') {
    return {
      title: meta.source,
      meta: `${meta.packageLabel} · ${meta.packageCount} 个包复用`,
      value: formatBytes(meta.bytes ?? meta.originalBytes),
    }
  }
  return {
    title: meta.source,
    meta: `${meta.packageLabel} · ${meta.fileName}`,
    value: formatBytes(meta.bytes),
  }
}

const largestFileItems = computed(() => props.visibleLargestFiles.map(file => ({
  key: `${file.packageId}:${file.file}`,
  file,
  active: props.activeLargestFileKey === `${file.packageId}:${file.file}`
    || (
      props.selectedTreemapMeta?.kind !== 'package'
      && props.selectedTreemapMeta?.packageLabel === file.packageLabel
      && props.selectedTreemapMeta?.fileName === file.file
    ),
  ...createLargestFileItem(file),
})))

const budgetItems = computed(() => props.budgetWarnings.slice(0, 6).map(item => ({
  key: item.id,
  warning: item,
  active: props.activeBudgetWarningId === item.id,
  ...createBudgetItem(item),
})))

const budgetLimitItems = computed(() => props.budgetLimitItems.map(item => ({
  key: item.key,
  title: item.label,
  meta: item.source === 'config' ? '来自配置' : '默认阈值',
  value: item.value,
})))

const selectedFileModuleItems = computed(() => props.selectedFileModules.map(item => ({
  key: item.key,
  title: item.source,
  meta: `${item.sourceType} · ${item.duplicatePackageCount > 1 ? `${item.duplicatePackageCount} 个包复用` : '单包模块'} · 可节省 ${formatBytes(item.estimatedSavingBytes)}`,
  value: item.originalBytes && item.originalBytes !== item.bytes
    ? `${formatBytes(item.bytes)} / ${formatBytes(item.originalBytes)}`
    : formatBytes(item.bytes),
})))

const selectedItem = computed(() => props.selectedTreemapMeta ? formatSelectedMeta(props.selectedTreemapMeta) : null)
</script>

<template>
  <AnalyzeDraggableGrid
    grid-class="grid h-full min-h-0 gap-2 overflow-hidden xl:grid-cols-3"
    :items="detailLayoutItems"
    storage-key="weapp-vite:dashboard:analyze-layout:files"
  >
    <template #top-files>
      <section class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-(--dashboard-border) bg-(--dashboard-panel) p-3 shadow-(--dashboard-shadow)">
        <div class="mb-2 flex items-center justify-between gap-3">
          <h3 class="text-sm font-semibold text-(--dashboard-text)">
            Top Files
          </h3>
          <span class="text-[11px] uppercase tracking-[0.16em] text-(--dashboard-text-soft)">size</span>
        </div>
        <div class="min-h-0 overflow-y-auto pr-1">
          <AppCompactListItem
            v-if="selectedItem"
            class="mb-2"
            v-bind="selectedItem"
          />
          <ol class="grid gap-2 text-sm">
            <AppCompactListItem
              v-for="item in largestFileItems"
              :key="item.key"
              :active="item.active"
              clickable
              :meta="item.meta"
              :title="item.title"
              :value="item.value"
              @select="emit('selectFile', item.file)"
            />
          </ol>
        </div>
      </section>
    </template>

    <template #file-modules>
      <section class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-(--dashboard-border) bg-(--dashboard-panel) p-3 shadow-(--dashboard-shadow)">
        <div class="mb-2 flex items-center justify-between gap-3">
          <h3 class="text-sm font-semibold text-(--dashboard-text)">
            文件详情
          </h3>
          <span class="text-[11px] uppercase tracking-[0.16em] text-(--dashboard-text-soft)">modules</span>
        </div>
        <ul class="grid min-h-0 gap-2 overflow-y-auto pr-1 text-sm text-(--dashboard-text-muted)">
          <AppEmptyState v-if="selectedFileModuleItems.length === 0" as="li" compact>
            选择一个 chunk 文件查看模块明细。
          </AppEmptyState>
          <AppCompactListItem
            v-for="item in selectedFileModuleItems"
            :key="item.key"
            :meta="item.meta"
            mono-title
            :title="item.title"
            :value="item.value"
          />
        </ul>
      </section>
    </template>

    <template #budget>
      <section class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-(--dashboard-border) bg-(--dashboard-panel) p-3 shadow-(--dashboard-shadow)">
        <div class="mb-2 flex items-center justify-between gap-3">
          <h3 class="text-sm font-semibold text-(--dashboard-text)">
            预算
          </h3>
          <span class="text-[11px] uppercase tracking-[0.16em] text-(--dashboard-text-soft)">limits</span>
        </div>
        <ul class="grid min-h-0 gap-2 overflow-y-auto pr-1 text-sm text-(--dashboard-text-muted)">
          <AppCompactListItem
            v-for="item in budgetItems"
            :key="item.key"
            :active="item.active"
            clickable
            :meta="item.meta"
            :title="item.title"
            :value="item.value"
            @select="emit('selectBudgetWarning', item.warning)"
          />
          <AppCompactListItem
            v-for="item in budgetLimitItems"
            :key="item.key"
            :meta="item.meta"
            :title="item.title"
            :value="item.value"
          />
        </ul>
      </section>
    </template>
  </AnalyzeDraggableGrid>
</template>
