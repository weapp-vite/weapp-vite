<script setup lang="ts">
import type {
  DashboardDetailItem,
  DuplicateModuleEntry,
  IncrementAttributionEntry,
  IncrementAttributionSummary,
  LargestFileEntry,
  ModuleSourceSummary,
} from '../types'
import { computed } from 'vue'
import { formatBuildOrigin, formatBytes } from '../utils/format'
import { surfaceStyles } from '../utils/styles'
import AppCompactListItem from './AppCompactListItem.vue'
import AppEmptyState from './AppEmptyState.vue'
import AppPanelHeader from './AppPanelHeader.vue'
import AppSummaryValueCard from './AppSummaryValueCard.vue'

const props = defineProps<{
  visibleDuplicateModules: DuplicateModuleEntry[]
  moduleSourceSummary: ModuleSourceSummary[]
  incrementAttribution: IncrementAttributionEntry[]
  incrementSummary: IncrementAttributionSummary[]
  visibleLargestFiles: LargestFileEntry[]
}>()

interface DuplicateModuleItem extends DashboardDetailItem {
  key: string
  packages: DuplicateModuleEntry['packages']
}

interface ListItemRow extends DashboardDetailItem {
  key: string
}

function createDuplicateModuleItem(module: DuplicateModuleEntry): DashboardDetailItem {
  return {
    title: module.source,
    meta: `${module.packageCount} 个包 · 单份 ${formatBytes(module.bytes)} · 可节省 ${formatBytes(module.estimatedSavingBytes)} · ${module.advice}`,
  }
}

function createModuleSourceItem(item: ModuleSourceSummary): DashboardDetailItem {
  return {
    title: item.sourceCategory,
    meta: `${item.count} 个模块`,
    value: formatBytes(item.bytes),
  }
}

function createIncrementItem(item: IncrementAttributionEntry): DashboardDetailItem {
  return {
    title: item.label,
    meta: `${item.category} · ${item.packageLabel} · ${item.advice}`,
    value: `+${formatBytes(item.deltaBytes)}`,
  }
}

function createIncrementSummaryItem(item: IncrementAttributionSummary): DashboardDetailItem {
  return {
    title: item.category,
    meta: `${item.count} 项增长`,
    value: `+${formatBytes(item.deltaBytes)}`,
  }
}

function createLargestFileSampleItem(file: LargestFileEntry): DashboardDetailItem {
  return {
    title: file.file,
    meta: `${file.packageLabel} · ${formatBuildOrigin(file.from)} · ${file.moduleCount} 模块`,
  }
}

const duplicateModuleItems = computed<DuplicateModuleItem[]>(() => props.visibleDuplicateModules.map(module => ({
  key: module.id,
  packages: module.packages,
  ...createDuplicateModuleItem(module),
})))

const moduleSourceItems = computed<ListItemRow[]>(() => props.moduleSourceSummary.map(item => ({
  key: `${item.sourceType}:${item.sourceCategory}`,
  ...createModuleSourceItem(item),
})))

const incrementItems = computed<ListItemRow[]>(() => props.incrementAttribution.slice(0, 8).map(item => ({
  key: item.key,
  ...createIncrementItem(item),
})))

const incrementSummaryItems = computed<ListItemRow[]>(() => props.incrementSummary.slice(0, 6).map(item => ({
  key: item.category,
  ...createIncrementSummaryItem(item),
})))

const largestFileSampleItems = computed<ListItemRow[]>(() => props.visibleLargestFiles.slice(0, 6).map(file => ({
  key: `${file.packageId}:${file.file}`,
  ...createLargestFileSampleItem(file),
})))
</script>

<template>
  <section class="grid h-full min-h-0 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1.24fr)_minmax(0,0.76fr)]">
    <div :class="surfaceStyles({ padding: 'md' })" class="min-h-0 overflow-hidden">
      <AppPanelHeader
        icon-name="duplicate-modules"
        title="重复模块"
        description="优先看被多个包重复包含的源码与依赖。"
      />
      <div v-if="duplicateModuleItems.length" class="mt-4 max-h-[calc(100%-3.5rem)] space-y-2.5 overflow-y-auto pr-1">
        <AppSummaryValueCard
          v-for="item in duplicateModuleItems"
          :key="item.key"
          v-bind="item"
          break-title
        >
          <ul class="mt-3 space-y-1.5 text-xs text-(--dashboard-text-muted)">
            <li v-for="pkg in item.packages" :key="`${item.key}:${pkg.packageId}`">
              <span class="font-medium text-(--dashboard-text)">{{ pkg.packageLabel }}</span>
              <span class="text-(--dashboard-text-soft)"> · </span>
              <span>{{ pkg.files.join('、') }}</span>
            </li>
          </ul>
        </AppSummaryValueCard>
      </div>
      <AppEmptyState v-else class="mt-4">
        当前构建未检测到跨包重复模块。
      </AppEmptyState>
    </div>

    <div class="grid min-h-0 gap-3 overflow-hidden xl:grid-rows-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <section :class="surfaceStyles({ padding: 'md' })" class="min-h-0 overflow-hidden">
        <AppPanelHeader icon-name="metric-time" title="增量归因" />
        <div v-if="incrementItems.length" class="mt-4 grid h-[calc(100%-3.5rem)] min-h-0 gap-3 overflow-hidden lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1fr)]">
          <div class="space-y-2 overflow-y-auto pr-1">
            <AppSummaryValueCard
              v-for="item in incrementSummaryItems"
              :key="item.key"
              v-bind="item"
            />
          </div>
          <ul class="space-y-2 overflow-y-auto pr-1 text-sm text-(--dashboard-text-muted)">
            <AppCompactListItem
              v-for="item in incrementItems"
              :key="item.key"
              v-bind="item"
              mono-title
            />
          </ul>
        </div>
        <AppEmptyState v-else class="mt-4">
          暂无可对比的正向增量。
        </AppEmptyState>
      </section>

      <section :class="surfaceStyles({ padding: 'md' })" class="min-h-0 overflow-hidden">
        <AppPanelHeader icon-name="module-sources" title="模块来源" />
        <div class="mt-4 grid h-[calc(100%-3.5rem)] min-h-0 gap-3 overflow-hidden lg:grid-cols-2">
          <div class="space-y-2.5 overflow-y-auto pr-1">
            <AppSummaryValueCard
              v-for="item in moduleSourceItems"
              :key="item.key"
              v-bind="item"
            />
          </div>
          <ul class="space-y-2.5 overflow-y-auto pr-1 text-sm text-(--dashboard-text-muted)">
            <AppCompactListItem
              v-for="item in largestFileSampleItems"
              :key="item.key"
              v-bind="item"
              mono-title
            />
          </ul>
        </div>
      </section>
    </div>
  </section>
</template>
