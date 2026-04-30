<script setup lang="ts">
import type { DashboardDetailItem, LargestFileEntry, PackageBudgetLimitItem, PackageBudgetWarning, SelectedFileModuleDetail, SubPackageDescriptor, TreemapNodeMeta } from '../types'
import { computed } from 'vue'
import { formatBytes, formatPackageType } from '../utils/format'
import { surfaceStyles } from '../utils/styles'
import AppCompactListItem from './AppCompactListItem.vue'
import AppEmptyState from './AppEmptyState.vue'
import AppPanelHeader from './AppPanelHeader.vue'
import TreemapCard from './TreemapCard.vue'

const props = defineProps<{
  bindChartRef: (element: Element | null) => void
  visibleLargestFiles: LargestFileEntry[]
  selectedFileModules: SelectedFileModuleDetail[]
  subPackages: SubPackageDescriptor[]
  budgetWarnings: PackageBudgetWarning[]
  budgetLimitItems: PackageBudgetLimitItem[]
  selectedTreemapMeta: TreemapNodeMeta | null
}>()

const emit = defineEmits<{
  selectFile: [file: LargestFileEntry]
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

function createSubPackageItem(pkg: SubPackageDescriptor): DashboardDetailItem {
  return {
    title: pkg.root,
    meta: `${pkg.name ? `别名 ${pkg.name}` : '未设置别名'} · ${pkg.independent ? '独立分包' : '普通分包'}`,
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
  ...createLargestFileItem(file),
})))

const subPackageItems = computed(() => props.subPackages.map(pkg => ({
  key: pkg.root,
  ...createSubPackageItem(pkg),
})))

const budgetItems = computed(() => props.budgetWarnings.slice(0, 6).map(item => ({
  key: item.id,
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
const hasSubPackageItems = computed(() => subPackageItems.value.length > 0)
</script>

<template>
  <section class="grid h-full min-h-0 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1.55fr)_minmax(21rem,0.75fr)] xl:items-stretch">
    <TreemapCard :bind-chart-ref="bindChartRef" />

    <div class="grid min-h-0 gap-3 overflow-hidden xl:grid-rows-[minmax(0,1fr)_minmax(0,0.64fr)_minmax(0,0.64fr)_minmax(0,0.64fr)]">
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
        <ol class="mt-3 grid h-[calc(100%-3.5rem)] min-h-0 gap-2 overflow-y-auto pr-1 text-sm xl:grid-cols-1">
          <AppCompactListItem
            v-for="item in largestFileItems"
            :key="item.key"
            v-bind="item"
            clickable
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
        <ul class="mt-3 grid h-[calc(100%-3.5rem)] min-h-0 gap-2 overflow-y-auto pr-1 text-sm text-(--dashboard-text-muted)">
          <AppEmptyState v-if="selectedFileModuleItems.length === 0" as="li" compact>
            选择一个 chunk 文件查看模块明细。
          </AppEmptyState>
          <AppCompactListItem
            v-for="item in selectedFileModuleItems"
            :key="item.key"
            v-bind="item"
            mono-title
          />
        </ul>
      </section>

      <section :class="surfaceStyles({ padding: 'md' })" class="min-h-0 overflow-hidden">
        <AppPanelHeader
          icon-name="metric-quality"
          title="预算"
          description="包体阈值"
        />
        <ul class="mt-3 grid h-[calc(100%-3.5rem)] min-h-0 gap-2 overflow-y-auto pr-1 text-sm text-(--dashboard-text-muted)">
          <AppCompactListItem
            v-for="item in budgetLimitItems"
            :key="item.key"
            v-bind="item"
          />
          <AppCompactListItem
            v-for="item in budgetItems"
            :key="item.key"
            v-bind="item"
          />
        </ul>
      </section>

      <section :class="surfaceStyles({ padding: 'md' })" class="min-h-0 overflow-hidden">
        <AppPanelHeader
          icon-name="subpackages"
          title="Subpackages"
          description="分包根目录与模式"
        >
          <template #meta>
            <span class="text-[11px] uppercase tracking-[0.2em] text-(--dashboard-text-soft)">Roots</span>
          </template>
        </AppPanelHeader>
        <ul class="mt-3 grid h-[calc(100%-3.5rem)] min-h-0 gap-2 overflow-y-auto pr-1 text-sm text-(--dashboard-text-muted)">
          <AppEmptyState v-if="!hasSubPackageItems" as="li" compact>
            当前构建没有配置分包。
          </AppEmptyState>
          <AppCompactListItem
            v-for="item in subPackageItems"
            :key="item.key"
            v-bind="item"
          />
        </ul>
      </section>
    </div>
  </section>
</template>
