<script setup lang="ts">
import type { DashboardDetailItem, LargestFileEntry, PackageBudgetWarning, SubPackageDescriptor, TreemapNodeMeta } from '../types'
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
  subPackages: SubPackageDescriptor[]
  budgetWarnings: PackageBudgetWarning[]
  selectedTreemapMeta: TreemapNodeMeta | null
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

const selectedItem = computed(() => props.selectedTreemapMeta ? formatSelectedMeta(props.selectedTreemapMeta) : null)
const hasSubPackageItems = computed(() => subPackageItems.value.length > 0)
</script>

<template>
  <section class="grid h-full min-h-0 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1.55fr)_minmax(21rem,0.75fr)] xl:items-stretch">
    <TreemapCard :bind-chart-ref="bindChartRef" />

    <div class="grid min-h-0 gap-3 overflow-hidden xl:grid-rows-[minmax(0,1fr)_minmax(0,0.64fr)_minmax(0,0.64fr)]">
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
          />
        </ol>
      </section>

      <section :class="surfaceStyles({ padding: 'md' })" class="min-h-0 overflow-hidden">
        <AppPanelHeader
          icon-name="metric-quality"
          title="预算"
          description="包体阈值"
        />
        <ul class="mt-3 grid h-[calc(100%-3.5rem)] min-h-0 gap-2 overflow-y-auto pr-1 text-sm text-(--dashboard-text-muted)">
          <AppEmptyState v-if="budgetItems.length === 0" as="li" compact>
            当前包体未触发预算告警。
          </AppEmptyState>
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
