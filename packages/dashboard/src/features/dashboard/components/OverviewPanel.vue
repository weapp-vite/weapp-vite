<script setup lang="ts">
import type { AnalyzeTreemapFilterMode, AnalyzeTreemapFilterOption, DashboardDetailItem, LargestFileEntry, PackageBudgetLimitItem, PackageBudgetWarning, SelectedFileModuleDetail, TreemapNodeMeta } from '../types'
import { computed } from 'vue'
import { formatBytes, formatPackageType } from '../utils/format'
import { surfaceStyles } from '../utils/styles'
import AppCompactListItem from './AppCompactListItem.vue'
import AppEmptyState from './AppEmptyState.vue'
import AppPanelHeader from './AppPanelHeader.vue'
import TreemapCard from './TreemapCard.vue'

const props = defineProps<{
  bindChartRef: (element: Element | null) => void
  canFocusTreemapSelection: boolean
  treemapFilterMode: AnalyzeTreemapFilterMode
  treemapFilterOptions: AnalyzeTreemapFilterOption[]
  canUseSelectedPackageFilter: boolean
  isTreemapEmpty: boolean
  visibleLargestFiles: LargestFileEntry[]
  selectedFileModules: SelectedFileModuleDetail[]
  budgetWarnings: PackageBudgetWarning[]
  budgetLimitItems: PackageBudgetLimitItem[]
  activeBudgetWarningId: string | null
  activeLargestFileKey: string | null
  selectedTreemapMeta: TreemapNodeMeta | null
}>()

const emit = defineEmits<{
  focusTreemapSelection: []
  resetTreemapFocus: []
  updateTreemapFilterMode: [mode: AnalyzeTreemapFilterMode]
  selectFile: [file: LargestFileEntry]
  selectBudgetWarning: [warning: PackageBudgetWarning]
}>()

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
  <section class="grid h-full min-h-0 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1.55fr)_minmax(21rem,0.75fr)] xl:items-stretch">
    <TreemapCard
      :bind-chart-ref="bindChartRef"
      :can-focus-selected="canFocusTreemapSelection"
      :filter-mode="treemapFilterMode"
      :filter-options="treemapFilterOptions"
      :can-use-selected-package-filter="canUseSelectedPackageFilter"
      :is-empty="isTreemapEmpty"
      @focus-selected="emit('focusTreemapSelection')"
      @reset-focus="emit('resetTreemapFocus')"
      @update-filter-mode="emit('updateTreemapFilterMode', $event)"
    />

    <div class="grid h-full min-h-0 gap-3 overflow-hidden xl:grid-rows-[minmax(0,1fr)_minmax(0,0.74fr)_minmax(0,1fr)]">
      <section :class="surfaceStyles({ padding: 'md' })" class="min-h-0 overflow-hidden">
        <AppPanelHeader
          icon-name="top-files"
          title="Top Files"
          description="最大体积样本"
        >
          <template #meta>
            <span class="text-[11px] uppercase tracking-[0.2em] text-(--dashboard-text-soft)">Top 10</span>
          </template>
        </AppPanelHeader>
        <AppCompactListItem
          v-if="selectedItem"
          class="mt-3"
          v-bind="selectedItem"
        />
        <ol class="mt-3 grid min-h-0 flex-1 gap-2 overflow-y-auto pr-1 text-sm xl:grid-cols-1">
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
      </section>

      <section :class="surfaceStyles({ padding: 'md' })" class="min-h-0 overflow-hidden">
        <AppPanelHeader
          icon-name="file-samples"
          title="文件详情"
          description="模块明细与复用收益"
        />
        <ul class="mt-3 grid min-h-0 flex-1 gap-2 overflow-y-auto pr-1 text-sm text-(--dashboard-text-muted)">
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

      <section :class="surfaceStyles({ padding: 'md' })" class="min-h-0 overflow-hidden">
        <AppPanelHeader
          icon-name="metric-quality"
          title="预算"
          description="包体阈值"
        />
        <ul class="mt-3 grid min-h-0 flex-1 gap-2 overflow-y-auto pr-1 text-sm text-(--dashboard-text-muted)">
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
    </div>
  </section>
</template>
